# AI-Based Cheating Detection System for Online Exams 🎓🔍


## Overview
Revolutionizing academic integrity in online exams, this AI-powered system detects cheating through **real-time head movement tracking** and **whisper/murmur detection**. Designed for institutions like Mekelle University, it addresses critical gaps in traditional proctoring tools by analyzing subtle behavioral cues often missed by conventional systems.

---

## Key Features 🚨
- **Multi-Modal Detection**  
  - Head pose estimation & gaze tracking via computer vision  
  - Whisper/murmur detection using audio frequency analysis  
- **Real-Time Alerts**  
  Immediate notifications for suspicious activity during exams  
- **Ethiopian Exam Integration**  
  Optimized for GAT, Exit Exams, and university assessments  
- **Privacy-First Design**  
  Minimal data retention with encrypted streams  

---

## How It Works 🤖
1. **Behavior Baseline**  
   Establishes normal movement/speech patterns during exam setup  
2. **Dual Analysis Streams**  
   - **Video Pipeline**: OpenCV + MediaPipe track facial landmarks  
   - **Audio Pipeline**: Librosa extracts voice features from microphone input  
3. **Anomaly Detection**  
   Machine learning models flag deviations (sudden head turns, low-volume speech)  
4. **Proctor Dashboard**  
   Visualizes alerts with blinking colors Red for cheating, Yellow for suspicious, and Green for normal behaviours. 

---

## Technical Stack 💻
| Component          | Technologies                                                                |
|--------------------|-----------------------------------------------------------------------------|
| **Computer Vision** | OpenCV, MediaPipe, CNN/RNN (TensorFlow/PyTorch)                            |
| **Audio Processing**| Librosa, Spectrogram Analysis, CNNs                                        |
| **AI Server**       | AioRTC - Python                                                            |
| **Backend**         | NodeJs                                                                     |
| **Frontend**        | React.js (Examiner Dashboard/Exam Portal)                                  |
| **Database**        | MongoDB                                                                    |
| **Datasets**        | Curated from Mendeley cheating behavior dataset + Mozilla Common Voice     |

---

## Demo 🎥
![Examiner Dashboard](docs/dashboard.png)  
*Real-time monitoring interface showing:*  
- Examiner Dashboard for monitoring students  
- Real TIme Alerts    

---

## Project Significance 🌍
- **Academic Trust**: Protects the value of Ethiopian university degrees  
- **Government Use**: Secures civil service exams and professional certifications  
- **Corporate Ready**: Ensures integrity in bank recruitment math assessments  

---

## Limitations ⚠️
- Requires minimum 720p webcam resolution  
- May struggle with heavy background noise  
- Not a replacement for human judgment - flags require proctor review  

---
