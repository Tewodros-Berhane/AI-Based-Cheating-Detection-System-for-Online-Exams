import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const withRouter = (WrappedComponent) => {
  function ComponentWithRouterProp(props) {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();

    const history = {
      push: (to, state) => navigate(to, { state }),
      replace: (to, state) => navigate(to, { replace: true, state }),
      goBack: () => navigate(-1),
      goForward: () => navigate(1),
    };

    const match = { params };

    return (
      <WrappedComponent
        {...props}
        history={history}
        location={location}
        match={match}
        navigate={navigate}
        params={params}
      />
    );
  }

  const wrappedName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  ComponentWithRouterProp.displayName = `withRouter(${wrappedName})`;

  return ComponentWithRouterProp;
};

export default withRouter;
