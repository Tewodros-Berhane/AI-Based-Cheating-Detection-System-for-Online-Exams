import { SecureGet } from './axiosCall';
import apis from './Apis';

export async function loadDashboard() {
  try {
    const res = await SecureGet({
      url: apis.GET_DASHBOARD
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
