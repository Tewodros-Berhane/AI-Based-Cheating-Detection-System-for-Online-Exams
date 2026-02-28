import { TOOGLE_NAVIGATION } from '../actions/types';


const initialState = {
    navigationCollapsed : true
}

const openDrawerReducer = (state = initialState, action )=>{
    switch(action.type){
        case TOOGLE_NAVIGATION:
            return {
                ...state,
                navigationCollapsed : !state.navigationCollapsed
            }  
        default:
            return state;
    }
}

export default openDrawerReducer;
