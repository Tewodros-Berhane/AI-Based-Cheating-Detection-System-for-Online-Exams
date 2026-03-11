import React from 'react';
import './backbone.css';
import { connect } from 'react-redux';
import AllTrainer from '../admin/allTrainer/alltrainer';
import AllTopics from '../admin/allTopics/alltopics.js';
import AllQuestions from '../trainer/allquestions/allquestion';
import AllTests from '../trainer/alltests/alltest';
import ConductTest from '../trainer/conducttest/conducttest';
import NewTest from '../trainer/newtest/newtest';
import auth from '../../services/AuthServices';
import Welcome from './welcome';
import ErrorPage from './errorPage';
import { login, logout } from '../../actions/loginAction';
import { changeActiveRoute } from '../../actions/useraction';
import Alert from '../common/alert';
import { Link, Navigate } from 'react-router-dom';
import { Layout, Menu,Button, Tooltip } from 'antd-compat';
import brandMark from '../../assets/examshield-mark.svg';
import withRouter from '../../utils/withRouter';
import { ADMIN_PERMISSIONS, TRAINER_PERMISSIONS } from '../../services/userOption';
import {
    BookOpenText,
    ClipboardList,
    FilePlus2,
    FileQuestion,
    LayoutDashboard,
    LogOut,
    MonitorPlay,
    PanelLeftClose,
    PanelLeftOpen,
    Users
} from 'lucide-react';
const { Header, Sider, Content } = Layout;

const sidebarIconMap = {
    dashboard: LayoutDashboard,
    examiners: Users,
    courses: BookOpenText,
    questions: FileQuestion,
    exams: ClipboardList,
    newExam: FilePlus2,
    liveSession: MonitorPlay
};

const normalizeDashboardRoute = (routeOption = 'home') =>
    routeOption === 'listtrainers' ? 'listexaminers' : routeOption;

const roleDisplayMap = {
    ADMIN: 'ADMIN',
    TRAINER: 'EXAMINER',
    TRAINEE: 'EXAMINEE'
};

class Dashboard extends React.Component{
    constructor(props){
        super(props);
        this.state={
            LocalIsLoggedIn : this.props.user.isLoggedIn,
            collapsed: true,
            authBootstrapping: true
        }
    }

    toggle = () => {
        this.setState({
          collapsed: !this.state.collapsed,
        });
    };

    redirectToHome = () => {
        if (this.props.history && this.props.history.replace) {
            this.props.history.replace('/');
            return;
        }
        window.location.replace('/');
    }

    logOut =()=>{
        this.props.logout();
        auth.deleteToken();
        this.setState({ LocalIsLoggedIn: false });
        this.redirectToHome();
    }

    renderSidebarIcon = (iconKey)=>{
        const IconComponent = sidebarIconMap[iconKey] || LayoutDashboard;
        return <IconComponent className="dashboard-menu-icon" size={18} strokeWidth={2.1} />;
    }

    componentDidMount(){
        var t = auth.retriveToken();
        if(!t || t === 'undefined'){
            this.setState({ authBootstrapping: false });
            this.logOut();
            return;
        }
        if(this.state.LocalIsLoggedIn && this.props.user && this.props.user.userDetails && this.props.user.userDetails.type){
            this.setState({ authBootstrapping: false });
            var existingSubUrl = (this.props.match && this.props.match.params && this.props.match.params.options) ? this.props.match.params.options : 'home';
            var normalizedExistingSubUrl = normalizeDashboardRoute(existingSubUrl);
            var existingPermissions = this.props.user.userDetails.type === 'ADMIN' ? ADMIN_PERMISSIONS : TRAINER_PERMISSIONS;
            var existingTargetLink = `/user/${normalizedExistingSubUrl}`;
            var existingRouteIndex = existingPermissions.findIndex((o)=>o.link === existingTargetLink);
            this.props.changeActiveRoute(String(existingRouteIndex === -1 ? 0 : existingRouteIndex));
            if(existingRouteIndex === -1){
                this.props.history.replace(existingPermissions[0].link);
            }
            else if(existingSubUrl !== normalizedExistingSubUrl){
                this.props.history.replace(existingTargetLink);
            }
        }
        else if(t && t!=='undefined'){
            auth.FetchAuth().then((response)=>{
                var user = response && response.data ? response.data.user : null;
                if(!user || !user.type){
                    throw new Error('Invalid user payload');
                }
                this.props.login(user);
                var permissions = user.type === 'ADMIN' ? ADMIN_PERMISSIONS : TRAINER_PERMISSIONS;
                var subUrl = (this.props.match && this.props.match.params && this.props.match.params.options) ? this.props.match.params.options : 'home';
                var normalizedSubUrl = normalizeDashboardRoute(subUrl);
                var targetLink = `/user/${normalizedSubUrl}`;
                var routeIndex = permissions.findIndex((o)=>o.link === targetLink);

                this.setState({
                    LocalIsLoggedIn : true,
                    authBootstrapping: false
                });
                if(routeIndex===-1){
                    this.props.changeActiveRoute('0');
                    this.props.history.replace(permissions[0].link);
                }
                else{
                    this.props.changeActiveRoute(String(routeIndex));
                    if(subUrl !== normalizedSubUrl){
                        this.props.history.replace(targetLink);
                    }
                }
            }).catch((error)=>{
                this.setState({ authBootstrapping: false });
                var message =
                    (error && error.response && error.response.data && error.response.data.message) ||
                    'Session validation failed. Please sign in again.';
                Alert('warning','Warning!',message);
                this.logOut();
                
            })
        }
        else{
            this.logOut();
        }
        
    }



    render(){
        const token = auth.retriveToken();
        if(!token || token === 'undefined'){
            return <Navigate to="/" replace />;
        }
        if (this.state.authBootstrapping) {
            return (
                <div className="dashboard-boot-loading">
                    <div className="app-route-loader">Loading workspace...</div>
                </div>
            );
        }
        const outerMargin = 10;
        const frameGap = 10;
        const headerHeight = 74;
        const routeOption = (this.props.match && this.props.match.params && this.props.match.params.options) ? this.props.match.params.options : 'home';
        const normalizedRouteOption = normalizeDashboardRoute(routeOption);
        const sectionTitles = {
            home: 'Command Center',
            listexaminers: 'Examiner Management',
            listsubjects: 'Course Management',
            listquestions: 'Question Library',
            listtests: 'Exam Library',
            newtest: 'Create Exam',
            conducttest: 'Live Exam Operations'
        };
        const sectionSubtitles = {
            home: 'Overview of platform health and recent activity',
            listexaminers: 'Invite, edit, and monitor examiner accounts',
            listsubjects: 'Maintain course taxonomy for test creation',
            listquestions: 'Curate and audit question quality',
            listtests: 'Track and review all published exams',
            newtest: 'Configure a new exam from question pools',
            conducttest: 'Run active sessions and monitor examinees'
        };
        const sectionTitle = sectionTitles[normalizedRouteOption] || 'Workspace';
        const sectionSubtitle = sectionSubtitles[normalizedRouteOption] || 'Manage and review exam workflows';
        const userName = this.props.user?.userDetails?.name || 'Operator';
        const userRole = this.props.user?.userDetails?.type || 'USER';
        const userRoleLabel = roleDisplayMap[userRole] || userRole;
        const siderWidth = this.state.collapsed ? 92 : 252;
        const contentOffset = outerMargin + siderWidth + frameGap;
        let torender = null;
        if(normalizedRouteOption==='listexaminers'){
            torender = <AllTrainer/>;
        }
        else if(normalizedRouteOption==='listsubjects'){
            torender = <AllTopics/>
        }
        else if(normalizedRouteOption==='listquestions'){
            torender = <AllQuestions/>
        }
        else if(normalizedRouteOption==='listtests'){
            torender = <AllTests/>
        }
        else if(normalizedRouteOption==='home'){
            torender=<Welcome />
        }
        else if(normalizedRouteOption==='newtest'){
            torender=<NewTest />
        }
        else if(normalizedRouteOption==='conducttest'){
            const params = Object.fromEntries(new URLSearchParams(this.props.location.search).entries());
            console.log(params)
            torender=<ConductTest {...params}/>
        }
        else{
            torender=<ErrorPage />
        }
        return (
            <Layout className="dashboard-layout-root">
                <Sider className="dashboard-sider" trigger={null} collapsible collapsed={this.state.collapsed} width={252} collapsedWidth={92}
                    style={{
                        overflow: 'hidden',
                        height: `calc(100vh - ${outerMargin * 2}px)`,
                        top: outerMargin,
                        position: 'fixed',
                        background: 'rgba(16, 26, 46, 0.74)',
                        left: outerMargin,
                        zIndex:5,
                        padding: '6px',
                        border: '1px solid var(--border-soft)',
                        borderRadius: '16px',
                        boxShadow: 'var(--shadow-soft)',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                    <div className={`dashboard-brand${this.state.collapsed ? ' is-collapsed' : ''}`}>
                        <img src={brandMark} alt="Exam Shield" className="dashboard-brand-mark" />
                        {!this.state.collapsed && (
                            <div className="dashboard-brand-text">
                                <h1>Exam Shield</h1>
                                <p>Operations Console</p>
                            </div>
                        )}
                    </div>
                    <Menu 
                        selectedKeys={[String(this.props.user.activeRoute)]}
                        mode="inline"
                        className="navy-menu"

                        >
                        {
                            this.props.user.userOptions.map((d,i)=>{
                                return(
                                    <Menu.Item key={String(i)} onClick={() => this.props.changeActiveRoute(String(i))}>
                                        {this.renderSidebarIcon(d.iconKey)}
                                        <span className="dashboard-menu-label">{d.display}</span>
                                        <Link to={d.link} className="dashboard-nav-link"></Link>
                                    </Menu.Item>
                                )
                            })
                        }
                    </Menu>
                </Sider>
                <Layout style={{ background: 'transparent' }}>
                    <Header className="navy-header" style={{ position:'fixed', top: outerMargin, left: contentOffset, right: outerMargin, zIndex:'1000' }}>
                        <div className="dashboard-header-left">
                            <Button className="trigger-button" shape="circle" onClick={this.toggle}>
                                {this.state.collapsed ? (
                                    <PanelLeftOpen className="dashboard-action-icon" size={17} strokeWidth={2.2} />
                                ) : (
                                    <PanelLeftClose className="dashboard-action-icon" size={17} strokeWidth={2.2} />
                                )}
                            </Button>
                            <div>
                                <h2 className="dashboard-route-title">{sectionTitle}</h2>
                                <p className="dashboard-route-subtitle">{sectionSubtitle}</p>
                            </div>
                        </div>
                        <div className="dashboard-header-right">
                            <div className="dashboard-user-meta">
                                <span className="dashboard-user-name">{userName}</span>
                                <span className="dashboard-user-role">{userRoleLabel}</span>
                            </div>
                            <Tooltip placement="bottom" title="Sign out">
                                <Button shape="circle" onClick={this.logOut} className="logout-button">
                                    <LogOut className="dashboard-action-icon" size={17} strokeWidth={2.3} />
                                </Button>
                            </Tooltip>
                        </div>
                    </Header>
                    <Content 
                        className='content'
                        style={{
                        margin: 0,
                        marginTop: outerMargin + headerHeight + frameGap,
                        marginLeft: contentOffset,
                        marginRight: outerMargin,
                        marginBottom: outerMargin,
                        height: `calc(100vh - ${outerMargin + headerHeight + frameGap + outerMargin}px)`,
                        padding: 0
                        }}
                    >
                        <div className="dashboard-content-shell">
                            {torender}
                        </div>
                    </Content>
                </Layout>
            </Layout> 
        );
    }
   
}

const mapStateToProps = state => ({
    user : state.user
});




export default withRouter(connect(mapStateToProps,{
    changeActiveRoute,
    login, 
    logout
})(Dashboard));

