import { ActionTypes } from './appState.js';

// Auth reducer
const authReducer = (state, action) => {
    switch (action.type) {
        case ActionTypes.LOGIN_SUCCESS:
            return {
                ...state,
                isAuthenticated: true,
                user: action.payload.user,
                csrfToken: action.payload.csrfToken
            };
        case ActionTypes.LOGOUT:
            return {
                ...state,
                isAuthenticated: false,
                user: null,
                csrfToken: null
            };
        case ActionTypes.UPDATE_AUTH:
            return {
                ...state,
                ...action.payload
            };
        default:
            return state;
    }
};

// Posts reducer
const postsReducer = (state, action) => {
    switch (action.type) {
        case ActionTypes.SET_POSTS:
            return {
                ...state,
                items: action.payload,
                loading: false,
                error: null
            };
        case ActionTypes.ADD_POST:
            return {
                ...state,
                items: [action.payload, ...state.items]
            };
        case ActionTypes.UPDATE_POST:
            return {
                ...state,
                items: state.items.map(post =>
                    post.id === action.payload.postId
                        ? { ...post, ...action.payload.updates }
                        : post
                )
            };
        case ActionTypes.DELETE_POST:
            return {
                ...state,
                items: state.items.filter(post => post.id !== action.payload)
            };
        default:
            return state;
    }
};

// Comments reducer
const commentsReducer = (state, action) => {
    switch (action.type) {
        case ActionTypes.SET_COMMENTS:
            return {
                ...state,
                byPostId: {
                    ...state.byPostId,
                    [action.payload.postId]: action.payload.comments
                },
                loading: false,
                error: null
            };
        case ActionTypes.ADD_COMMENT:
            const postId = action.payload.postId;
            return {
                ...state,
                byPostId: {
                    ...state.byPostId,
                    [postId]: [
                        action.payload,
                        ...(state.byPostId[postId] || [])
                    ]
                }
            };
        case ActionTypes.UPDATE_COMMENT:
            return {
                ...state,
                byPostId: {
                    ...state.byPostId,
                    [action.payload.postId]: state.byPostId[action.payload.postId].map(
                        comment => comment.id === action.payload.commentId
                            ? { ...comment, ...action.payload.updates }
                            : comment
                    )
                }
            };
        default:
            return state;
    }
};

// Votes reducer
const votesReducer = (state, action) => {
    switch (action.type) {
        case ActionTypes.UPDATE_POST_VOTE:
            return {
                ...state,
                posts: {
                    ...state.posts,
                    [action.payload.id]: action.payload.voteType
                }
            };
        case ActionTypes.UPDATE_COMMENT_VOTE:
            return {
                ...state,
                comments: {
                    ...state.comments,
                    [action.payload.id]: action.payload.voteType
                }
            };
        default:
            return state;
    }
};

// UI reducer
const uiReducer = (state, action) => {
    switch (action.type) {
        case ActionTypes.SET_THEME:
            return {
                ...state,
                theme: action.payload
            };
        case ActionTypes.ADD_NOTIFICATION:
            return {
                ...state,
                notifications: [...state.notifications, action.payload]
            };
        case ActionTypes.REMOVE_NOTIFICATION:
            return {
                ...state,
                notifications: state.notifications.filter(
                    n => n.id !== action.payload
                )
            };
        case ActionTypes.SET_CURRENT_ROUTE:
            return {
                ...state,
                currentRoute: action.payload
            };
        default:
            return state;
    }
};

// Root reducer
export const rootReducer = (state, action) => {
    return {
        auth: authReducer(state.auth, action),
        posts: postsReducer(state.posts, action),
        comments: commentsReducer(state.comments, action),
        votes: votesReducer(state.votes, action),
        ui: uiReducer(state.ui, action)
    };
}; 