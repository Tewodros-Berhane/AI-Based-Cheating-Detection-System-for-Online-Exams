import apis from "./Apis";
import { Post, SecureGet } from './axiosCall';


class AuthService{
    constructor(){
        this.token=null;
    }
    
    retriveToken = ()=>{
        return localStorage.getItem('Token')
    }

    storeToken = (t)=>{
        localStorage.setItem('Token', t);
    }

    deleteToken = ()=>{
        localStorage.removeItem('Token');
    }

    LoginAuth = (u,p)=>{
        return Post({
            url:apis.LOGIN,
            data:{
                emailid : u,
                password : p
            }
        })    
    }

    FetchAuth = ()=>{
        return SecureGet({
            url : apis.GETDETAILSUSER
        })
    }

    wakeUp = ()=>{
        return this.FetchAuth();
    }


}
const authService = new AuthService();

export default authService;
