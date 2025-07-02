import React from 'react';
import { Card,Rate, Comment, Avatar  } from 'antd';
import './testdetails.css';
export default function FeedBacks(props) {
    console.log(props.feedbacks);
    return (
        <div> 
            <Card >
                <div className="download-section" >
                    <h3 style={{color: '#c9d1d9',}}><b>Feedbacks</b></h3>
                    <div style={{color: '#c9d1d9',}}>
                        {props.feedbacks.map((d,i)=>{
                            return(
                                <Card key={i} style={{marginBottom:'10px'}}>
                                    <Comment
                                        author={`${d.userid.name} - ${d.userid.organisation} `}
                                        avatar={
                                            <Avatar
                                                src={d.userid.faceImageUrl}
                                                alt={d.userid.name}
                                            />
                                        }
                                        content={
                                            <span style={{color: '#c9d1d9',}}>
                                                <Rate disabled value={Number(d.rating)} style={{ fontSize: '14px' }} />
                                                <p style={{color: '#c9d1d9',}}>
                                                    {d.feedback}
                                                </p>
                                            </span>
                                        }
                                    />
                                </Card>
                            ) 
                        })}
                    </div>
                </div>
            </Card>
        </div>
    )
}
