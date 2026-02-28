import auth from './AuthServices';
import apis from './Apis';
import axios from 'axios';
const DEFAULT_TIMEOUT_MS = 15000;

const buildAuthHeaders = (headers = {}) => {
    const token = auth.retriveToken();
    if (!token) return headers;
    return {
        ...headers,
        Authorization: `Bearer ${token}`
    };
};

export const SecureGet = (p = {})=>{
    return axios({
        method:'get',
        baseURL : apis.BASE,
        timeout: DEFAULT_TIMEOUT_MS,
        ...p,
        headers: buildAuthHeaders(p.headers)
    })
}

export const Get =(p = {})=>{
    return axios({
        method:'get',
        baseURL : apis.BASE,
        timeout: DEFAULT_TIMEOUT_MS,
        ...p,
    })
}


export const SecurePost =(p = {})=>{
    return axios({
        method:'post',
        baseURL : apis.BASE,
        timeout: DEFAULT_TIMEOUT_MS,
        ...p,
        headers: buildAuthHeaders(p.headers)
    })
}

export const Post =(p = {})=>{
    return axios({
        baseURL : apis.BASE,
        method:'post',
        timeout: DEFAULT_TIMEOUT_MS,
        ...p,
    })
}



