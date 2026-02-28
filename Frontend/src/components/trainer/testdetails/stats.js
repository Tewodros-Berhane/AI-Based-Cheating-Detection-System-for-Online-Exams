import React, { Component } from 'react';
import './testdetails.css';
import { Row, Col } from 'antd-compat';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import {bgcolor,bordercolor} from '../../../services/bgcolor';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);


export default class Stats extends Component {
    constructor(props){
        super(props);
        this.state={
            id:this.props.id,
            stats:this.props.stats,
            Scorelable:[],
            Scoredata:[],
            bgColor1:[],
            borcolor1:[],
            maxmMarks:this.props.maxmMarks,
            passData:[0,0],
            passLable:['Fail','Pass'],
            stat:['91% to 100%','81% to 90%','71% to 80%','61% to 70%','50% to 60%','Below 50%'],
            statdata:[0,0,0,0,0,0]

        } 
    }

    extractFileName = (url = '') => {
        try {
            const clean = String(url).split('?')[0];
            return clean.substring(clean.lastIndexOf('/') + 1) || 'exam-results.xlsx';
        } catch (error) {
            return 'exam-results.xlsx';
        }
    }

    downloadExcel = async () => {
        const fileUrl = this.props.file;
        if (!fileUrl) {
            return;
        }

        try {
            const response = await fetch(fileUrl, { method: 'GET' });
            if (!response.ok) {
                throw new Error(`Download failed with status ${response.status}`);
            }

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = this.extractFileName(fileUrl);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch (error) {
            window.open(fileUrl, '_blank', 'noopener,noreferrer');
        }
    }
    
    componentDidMount(){
        let {bgColor1,borcolor1}=this.state;
        var maxi=-1;
        let p=0;
        let f=0;
        let p90_100=0;
        let p80_90=0;
        let p70_80=0;
        let p60_70=0;
        let p50_60=0;
        let below50=0;
        var pc=0;
        this.state.stats.forEach((d)=>{
            const safeMaxMarks = this.state.maxmMarks > 0 ? this.state.maxmMarks : 1;
            pc=(d.score/safeMaxMarks)*100;
            if(pc>=91){
                p90_100++;
            }
            else if(pc>=81){
                p80_90++;
            }
            else if(pc>=71){
                p70_80++;
            }
            else if(pc>=61){
                p60_70++;
            }
            else if(pc>=50){
                p50_60++;
            }
            else{
                below50++;
            }

            if(d.score>=this.state.maxmMarks/2){
                p++;
            }
            else{
                f++;
            }
            if(d.score>maxi){
                maxi=d.score
            }
        })
        var dp =[];
        var label = [];
        
        for(let i=0;i<=maxi;i++){
            dp.push(0);
            label.push(i);
            bgColor1.push(bgcolor[i]);
            borcolor1.push(bordercolor[i]);

        }
        
        this.state.stats.forEach((d)=>{
            dp[d.score]++;
        })  
        this.setState({
            Scorelable:label,
            Scoredata:dp,
            bgColor1:bgColor1,
            borcolor1:borcolor1,
            passData:[f,p],
            statdata:[p90_100,p80_90,p70_80,p60_70,p50_60,below50]
        })      
    }

    render() {
        let barData={
            labels:this.state.Scorelable,
            datasets:[{
                label: 'Scores',
                data: this.state.Scoredata,
                backgroundColor:this.state.bgColor1,
                borderColor:this.state.borcolor1,
                borderWidth: 1
            }]
        }
        let DoughNutData1={
            labels:this.state.passLable,
            datasets:[{
                label: 'Pass/Fail',
                data: this.state.passData,
                backgroundColor:[bgcolor[0],bgcolor[1]],
                borderColor:[bordercolor[0],bordercolor[1]],
                borderWidth: 1
            }]
        }
        let DoughNutData2={
            labels:this.state.stat,
            datasets:[{
                label: 'Percentage wise category',
                data: this.state.statdata,
                backgroundColor:[bgcolor[0],bgcolor[1],bgcolor[2],bgcolor[3],bgcolor[4],bgcolor[5]],
                borderColor:[bordercolor[0],bordercolor[1],bordercolor[2],bordercolor[3],bordercolor[4],bordercolor[5]],
                borderWidth: 1
            }]
        }
        return (
            <div className="testdetails-stats-stack">
                <section className="testdetails-block">
                    <div className="testdetails-block-head">
                        <h4>Result Export</h4>
                        <p>Download the generated score report for archive or offline review.</p>
                    </div>
                    <div className="download-section">
                        <button type="button" className="download-xlsx" onClick={this.downloadExcel}>Download Excel</button>
                    </div>
                </section>

                <section className="testdetails-block">
                    <div className="testdetails-block-head">
                        <h4>Score Distribution</h4>
                        <p>Compare score spread against candidate count.</p>
                    </div>
                    <div className="testdetails-chart-wrap testdetails-chart-wrap-bar">
                        <Bar
                            data={barData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false }
                                }
                            }}
                        />
                    </div>
                </section>

                <section className="testdetails-block">
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <div className="testdetails-chart-block">
                                <div className="testdetails-block-head">
                                    <h4>Pass / Fail</h4>
                                    <p>Outcome split based on 50% threshold.</p>
                                </div>
                                <div className="testdetails-chart-wrap">
                                    <Doughnut data={DoughNutData1} />
                                </div>
                            </div>
                        </Col>
                        <Col xs={24} md={12}>
                            <div className="testdetails-chart-block">
                                <div className="testdetails-block-head">
                                    <h4>Score Bands</h4>
                                    <p>Candidate distribution by percentage range.</p>
                                </div>
                                <div className="testdetails-chart-wrap">
                                    <Doughnut data={DoughNutData2} />
                                </div>
                            </div>
                        </Col>
                    </Row>
                </section>
            </div>
        )
    }
}

