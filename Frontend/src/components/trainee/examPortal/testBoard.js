import React,{ useState, useEffect } from 'react'
import './portal.css';
import Sidepanel from './sidepanel'
import Question from './question';
import {Drawer} from "antd-compat";


function getWindowDimensions() {
    const { innerWidth: width, innerHeight: height } = window;
    return {
        width,
        height
    };
}

function useWindowDimensions() {
    const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());
  
    useEffect(() => {
        function handleResize() {
            setWindowDimensions(getWindowDimensions());
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
  
    return windowDimensions;
}



export default function TestBoard(props) {
    const { width } = useWindowDimensions();
    const [visible,setVisible]=useState(false);
    const isMobile = width <= 980;

    let onClose=()=>setVisible(false);
    let onOpen=()=>setVisible(true);
    if(!isMobile){
        return (
            <div className="exam-dashboard-wrapper">
                <Question mode="desktop" triggerSidebar={onOpen}/>
                <Sidepanel mode="desktop" />
            </div>
        )
    }
    else{
        return (
            <div className="exam-dashboard-wrapper">
                <Question mode="mobile" triggerSidebar={onOpen} />
                <Drawer
                    title="Toolbar"
                    placement="right"
                    closable={true}
                    onClose={onClose}
                    open={visible}
                    width="100%"
                >
                    <Sidepanel mode="mobile"/>    
                </Drawer>
            </div>
        )
    }
    
}

