import store, { actions } from './appState.js';

// Hook to select a slice of state
export function useSelector(selector) {
    const [state, setState] = useState(selector(store.state));
    
    useEffect(() => {
        return store.subscribe((newState) => {
            setState(selector(newState));
        });
    }, [selector]);
    
    return state;
}

// Hook to get dispatch function
export function useDispatch() {
    return store.dispatch.bind(store);
}

// Custom hooks for specific state slices
export function useAuth() {
    const auth = useSelector(state => state.auth);
    const dispatch = useDispatch();
    
    return {
        ...auth,
        login: (userData) => dispatch(actions.loginSuccess(userData)),
        logout: () => dispatch(actions.logout()),
        updateAuth: (updates) => dispatch({ type: 'auth/update', payload: updates })
    };
}

export function usePosts() {
    const posts = useSelector(state => state.posts);
    const dispatch = useDispatch();
    
    return {
        ...posts,
        setPosts: (posts) => dispatch(actions.setPosts(posts)),
        addPost: (post) => dispatch(actions.addPost(post)),
        updatePost: (postId, updates) => dispatch(actions.updatePost(postId, updates)),
        deletePost: (postId) => dispatch({ type: 'posts/deletePost', payload: postId })
    };
}

export function useComments(postId) {
    const comments = useSelector(state => state.comments.byPostId[postId] || []);
    const dispatch = useDispatch();
    
    return {
        comments,
        setComments: (comments) => dispatch(actions.setComments(postId, comments)),
        addComment: (comment) => dispatch(actions.addComment({ ...comment, postId })),
        updateComment: (commentId, updates) => 
            dispatch(actions.updateComment(postId, commentId, updates))
    };
}

export function useVotes() {
    const votes = useSelector(state => state.votes);
    const dispatch = useDispatch();
    
    return {
        ...votes,
        updateVote: (type, id, voteType) => dispatch(actions.updateVote(type, id, voteType))
    };
}

export function useUI() {
    const ui = useSelector(state => state.ui);
    const dispatch = useDispatch();
    
    return {
        ...ui,
        setTheme: (theme) => dispatch(actions.setTheme(theme)),
        addNotification: (notification) => 
            dispatch(actions.addNotification({ id: Date.now(), ...notification })),
        removeNotification: (id) => 
            dispatch({ type: 'ui/removeNotification', payload: id }),
        setCurrentRoute: (route) => dispatch(actions.setCurrentRoute(route))
    };
}

// Helper function to create useState-like API
function useState(initialState) {
    let state = initialState;
    const listeners = new Set();
    
    const setState = (newState) => {
        state = typeof newState === 'function' ? newState(state) : newState;
        listeners.forEach(listener => listener(state));
    };
    
    return [state, setState];
}

// Helper function to create useEffect-like API
function useEffect(callback, dependencies) {
    let cleanup = null;
    let oldDeps = dependencies;
    
    const checkDeps = () => {
        const hasChanged = !oldDeps || 
            !dependencies || 
            oldDeps.length !== dependencies.length ||
            dependencies.some((dep, i) => dep !== oldDeps[i]);
            
        if (hasChanged) {
            if (cleanup) cleanup();
            cleanup = callback();
            oldDeps = dependencies;
        }
    };
    
    checkDeps();
    return () => {
        if (cleanup) cleanup();
    };
} 