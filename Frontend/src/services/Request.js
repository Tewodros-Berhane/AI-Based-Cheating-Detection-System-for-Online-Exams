const axios = require('axios');
import LocalAuth from './AuthServices';
const base = require("./conf").base;

const authHeaders = (headers = {}) => {
    const token = LocalAuth.retriveToken();
    if (!token) return headers;
    return {
        ...headers,
        Authorization: `Bearer ${token}`
    };
};

let get = (uri,params=null)=>{
    return axios({
        method : 'get',
        url : uri,
        baseURL : base,
        params : params,
        headers : authHeaders()
    });
}

let post = (uri,params=null,data=null,others={})=>{
    return axios({
        method : 'post',
        url : uri,
        baseURL : base,
        params : params,
        data : data,
        ...others,
        headers : authHeaders(others.headers)
    });
}


module.exports = { get, post }
