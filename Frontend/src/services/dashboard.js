import { Get, Post} from './axiosCall';
import apis from './Apis';

export async function loadDashboard() {
  const token = localStorage.getItem('Token');

  try {
    const res = await Get({
      url: apis.GET_DASHBOARD,
      params : {
        Token : token
    }
    });
    return res.data;
  } catch (err) {
    console.error('Dashboard fetch failed:', err);

    let message = 'Something went wrong';
    if (err.response && err.response.data && err.response.data.message) {
      message = err.response.data.message;
    } else if (err.message) {
      message = err.message;
    }

    throw new Error('Dashboard fetch failed: ' + message);
  }
}
