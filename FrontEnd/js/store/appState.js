import { Store } from './store.js';

// Initial state
const initialState = {
    auth: {
        isAuthenticated: false,
        user: null,
        csrfToken: null,
    },
    posts: {
        items: [],
        loading: false,
        error: null,
    },
    comments: {
        byPostId: {},
        loading: false,
        error: null,
    },
    votes: {
        posts: {},
        comments: {},
    },
    ui: {
        theme: localStorage.getItem('theme') || 'light',
        notifications: [],
        currentRoute: window.location.pathname,
    }
};

// Action Types
export const ActionTypes = {
    // Auth Actions
    LOGIN_SUCCESS: 'auth/loginSuccess',
    LOGOUT: 'auth/logout',
    UPDATE_AUTH: 'auth/update',
    
    // Posts Actions
    SET_POSTS: 'posts/setPosts',
    ADD_POST: 'posts/addPost',
    UPDATE_POST: 'posts/updatePost',
    DELETE_POST: 'posts/deletePost',
    
    // Comments Actions
    SET_COMMENTS: 'comments/setComments',
    ADD_COMMENT: 'comments/addComment',
    UPDATE_COMMENT: 'comments/updateComment',
    
    // Votes Actions
    UPDATE_POST_VOTE: 'votes/updatePostVote',
    UPDATE_COMMENT_VOTE: 'votes/updateCommentVote',
    
    // UI Actions
    SET_THEME: 'ui/setTheme',
    ADD_NOTIFICATION: 'ui/addNotification',
    REMOVE_NOTIFICATION: 'ui/removeNotification',
    SET_CURRENT_ROUTE: 'ui/setCurrentRoute'
};

// Create store instance
const store = new Store(initialState);

// Add logging middleware
store.use((action, state) => {
    console.log('Action:', action.type, action.payload);
    console.log('Current State:', state);
    return action;
});

// Add persistence middleware for specific state slices
store.use((action) => {
    const persistentActions = [
        ActionTypes.SET_THEME,
        ActionTypes.LOGIN_SUCCESS,
        ActionTypes.LOGOUT
    ];

    if (persistentActions.includes(action.type)) {
        // Handle persistence based on action type
        switch (action.type) {
            case ActionTypes.SET_THEME:
                localStorage.setItem('theme', action.payload);
                break;
            case ActionTypes.LOGIN_SUCCESS:
                localStorage.setItem('csrfToken', action.payload.csrfToken);
                break;
            case ActionTypes.LOGOUT:
                localStorage.removeItem('csrfToken');
                break;
        }
    }
    return action;
});

// Action Creators
export const actions = {
    loginSuccess: (userData) => ({
        type: ActionTypes.LOGIN_SUCCESS,
        payload: userData
    }),
    
    logout: () => ({
        type: ActionTypes.LOGOUT
    }),
    
    setPosts: (posts) => ({
        type: ActionTypes.SET_POSTS,
        payload: posts
    }),
    
    addPost: (post) => ({
        type: ActionTypes.ADD_POST,
        payload: post
    }),
    
    updatePost: (postId, updates) => ({
        type: ActionTypes.UPDATE_POST,
        payload: { postId, updates }
    }),
    
    setComments: (postId, comments) => ({
        type: ActionTypes.SET_COMMENTS,
        payload: { postId, comments }
    }),
    
    updateVote: (type, id, voteType) => ({
        type: type === 'post' ? ActionTypes.UPDATE_POST_VOTE : ActionTypes.UPDATE_COMMENT_VOTE,
        payload: { id, voteType }
    }),
    
    setTheme: (theme) => ({
        type: ActionTypes.SET_THEME,
        payload: theme
    }),
    
    addNotification: (notification) => ({
        type: ActionTypes.ADD_NOTIFICATION,
        payload: notification
    }),
    
    setCurrentRoute: (route) => ({
        type: ActionTypes.SET_CURRENT_ROUTE,
        payload: route
    })
};

export default store; 