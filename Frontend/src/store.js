import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import rootReducer from './reducers/index';


const initialState={};
const middleware=[thunk];

if (process.env.NODE_ENV !== 'production') {
    const { createLogger } = require('redux-logger');
    middleware.push(createLogger());
}


const store = createStore(
    rootReducer, 
    initialState, 
    applyMiddleware(...middleware)
);


export default store;
