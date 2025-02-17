// Core store implementation
import { rootReducer } from './reducers.js';

export class Store {
    constructor(initialState = {}) {
        this._state = initialState;
        this._listeners = new Set();
        this._middlewares = [];
        this._securityMiddleware = this._createSecurityMiddleware();
        
        // Proxy to make state immutable
        this.state = new Proxy(this._state, {
            get: (target, prop) => target[prop],
            set: () => {
                console.error('Direct state mutation is not allowed. Use dispatch instead.');
                return false;
            }
        });
    }

    // Add middleware
    use(middleware) {
        this._middlewares.push(middleware);
    }

    // Subscribe to state changes
    subscribe(listener) {
        this._listeners.add(listener);
        // Return unsubscribe function
        return () => this._listeners.delete(listener);
    }

    // Dispatch an action to update state
    async dispatch(action) {
        if (!action || typeof action !== 'object' || !action.type) {
            throw new Error('Actions must be objects with a type property');
        }

        // Create middleware chain
        const chain = [this._securityMiddleware, ...this._middlewares];
        let promise = Promise.resolve(action);

        // Apply all middlewares
        chain.forEach(middleware => {
            promise = promise.then(action => middleware(action, this.state));
        });

        try {
            const finalAction = await promise;
            this._updateState(finalAction);
        } catch (error) {
            console.error('Action rejected by middleware:', error);
            throw error;
        }
    }

    // Private method to update state
    _updateState(action) {
        const newState = rootReducer(this._state, action);
        this._state = Object.freeze({ ...newState });
        this._notifyListeners();
    }

    // Private method to notify subscribers
    _notifyListeners() {
        this._listeners.forEach(listener => listener(this.state));
    }

    // Security middleware
    _createSecurityMiddleware() {
        return (action) => {
            // Validate action structure
            if (!action || typeof action !== 'object') {
                throw new Error('Invalid action format');
            }

            // Sanitize action payload
            const sanitizedAction = this._sanitizePayload(action);

            // Add timestamp for audit
            return {
                ...sanitizedAction,
                timestamp: new Date().toISOString()
            };
        };
    }

    // Sanitize payload to prevent XSS
    _sanitizePayload(action) {
        const sanitize = (value) => {
            if (typeof value === 'string') {
                return value.replace(/[<>]/g, '');
            }
            if (typeof value === 'object' && value !== null) {
                return Object.keys(value).reduce((acc, key) => ({
                    ...acc,
                    [key]: sanitize(value[key])
                }), Array.isArray(value) ? [] : {});
            }
            return value;
        };

        return {
            ...action,
            payload: action.payload ? sanitize(action.payload) : action.payload
        };
    }
} 