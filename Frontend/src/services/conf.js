const base = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';
const LoginApi = '/api/v1/login';
const FetchUserDetailsApi = '/api/v1/user/details';

module.exports={ base, LoginApi, FetchUserDetailsApi }
