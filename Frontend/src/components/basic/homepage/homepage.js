import React from 'react';
import './homepage.css'; 
import { connect } from 'react-redux';
import Login from '../login/login';
import auth from '../../../services/AuthServices';
import { Redirect } from 'react-router-dom';


function Homepage(props) {
  if(auth.retriveToken() && auth.retriveToken()!=='undefined'){
    console.log('Logged In');
    return <Redirect to='/user/home' />
  }
  else{
    console.log('Not Logged In');
    return (
      <div>
         <div className="homepage-container">
              <Login />
            </div>
          </div>
    );
  }
}

const mapStateToProps = state => ({
  user : state.user
});

export default connect(mapStateToProps,{
  
})(Homepage);
