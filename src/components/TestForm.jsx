import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function TestForm() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [userDetails, setUserDetails] = useState({
    name: '',
    email: '',
    batch: ''
  });
  const [answers, setAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Media stream states
  const [hasMediaPermissions, setHasMediaPermissions] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenExitCountRef = useRef(0);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [cameraDisconnected, setCameraDisconnected] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const checkStreamIntervalRef = useRef(null);
  const frameMonitorIntervalRef = useRef(null);
  const fullscreenRetryTimeoutRef = useRef(null);

  // Enhanced camera initialization with device ID tracking
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);

  // Disable ESC key during test
  useEffect(() => {
    if (!submitted) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        fullscreenExitCountRef.current += 1;
        const exitCount = fullscreenExitCountRef.current;
        
        if (exitCount <= 3) {
          toast.warn(
            `Warning ${exitCount}/3: ESC key disabled during test! ${
              3 - exitCount > 0 
                ? `${3 - exitCount} more warning${3 - exitCount > 1 ? 's' : ''} before auto-submit.` 
                : 'Test will be auto-submitted!'
            }`,
            { autoClose: false, toastId: 'esc-warning' }
          );
        }

        if (exitCount >= 3) {
          handleAutoSubmit();
          toast.error('Test auto-submitted due to multiple ESC key presses!');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [submitted]);

  // Get available camera devices
  const getVideoDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableDevices(videoDevices);
      return videoDevices;
    } catch (error) {
      console.error("Error enumerating devices:", error);
      return [];
    }
  }, []);

  // Initialize camera with specific device
  const initializeCamera = useCallback(async (deviceId = null) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not available");
      }

      const constraints = {
        audio: true,
        video: {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { ideal: 30, min: 15 }
        }
      };

      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      } else {
        constraints.video.facingMode = 'user';
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      
      if (!videoTrack) {
        throw new Error("No video track available");
      }

      // Stop previous stream if exists
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      mediaStreamRef.current = stream;
      setCurrentDeviceId(videoTrack.getSettings().deviceId);
      setStreamActive(true);
      setCameraDisconnected(false);

      // Setup video element with retries
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          const onLoaded = () => {
            if (videoRef.current.readyState >= 2) { // HAVE_ENOUGH_DATA
              videoRef.current.play().then(resolve).catch(() => {
                // Retry play if failed
                setTimeout(() => {
                  videoRef.current.play().then(resolve).catch(resolve);
                }, 500);
              });
            } else {
              videoRef.current.addEventListener('canplay', () => {
                videoRef.current.play().then(resolve).catch(resolve);
              }, { once: true });
            }
          };

          if (videoRef.current.readyState >= 1) { // HAVE_METADATA
            onLoaded();
          } else {
            videoRef.current.onloadedmetadata = onLoaded;
          }
        });
      }

      // Monitor for track ending
      videoTrack.addEventListener('ended', () => {
        setCameraDisconnected(true);
        setStreamActive(false);
        toast.error("Camera disconnected! Trying to reconnect...");
        initializeCamera(currentDeviceId).catch(() => {
          // If reconnecting with same device fails, try any available camera
          initializeCamera().catch(console.error);
        });
      });

      return true;
    } catch (error) {
      console.error("Camera initialization failed:", error);
      setMediaError(error.message);
      setCameraDisconnected(true);
      setStreamActive(false);
      
      // Try again without device constraints if specific device failed
      if (deviceId && error.name === 'OverconstrainedError') {
        return initializeCamera();
      }
      
      return false;
    }
  }, [currentDeviceId]);

  // Frame monitoring for black screen detection
  const startFrameMonitoring = useCallback(() => {
    if (frameMonitorIntervalRef.current) {
      clearInterval(frameMonitorIntervalRef.current);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let blankCount = 0;

    frameMonitorIntervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.videoWidth === 0) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixelValues = imageData.data;
      let totalLuminance = 0;

      // Calculate frame luminance
      for (let i = 0; i < pixelValues.length; i += 4) {
        totalLuminance += 0.299 * pixelValues[i] + 
                         0.587 * pixelValues[i+1] + 
                         0.114 * pixelValues[i+2];
      }

      const avgLuminance = totalLuminance / (pixelValues.length / 4);
      
      // Detect black frames (luminance < 10)
      if (avgLuminance < 10) {
        blankCount++;
        if (blankCount > 5) {
          toast.warn("Camera feed lost - attempting to reconnect...");
          initializeCamera(currentDeviceId);
          blankCount = 0;
        }
      } else {
        blankCount = 0;
      }
    }, 1000);
  }, [initializeCamera, currentDeviceId]);

  // Robust fullscreen handling with auto-submit after 3 warnings
  const enterFullscreen = useCallback(async () => {
    if (fullscreenRetryTimeoutRef.current) {
      clearTimeout(fullscreenRetryTimeoutRef.current);
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setShowFullscreenWarning(false);
        toast.dismiss('fullscreen-warning');
      }
    } catch (error) {
      console.warn("Fullscreen error:", error);
      // Retry after delay if failed
      fullscreenRetryTimeoutRef.current = setTimeout(() => {
        enterFullscreen();
      }, 500);
    }
  }, []);

  // Fullscreen enforcement with auto-submit
  useEffect(() => {
    if (!submitted) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen) {
        fullscreenExitCountRef.current += 1;
        const exitCount = fullscreenExitCountRef.current;
        
        setShowFullscreenWarning(true);
        
        if (exitCount <= 3) {
          toast.warn(
            `Warning ${exitCount}/3: Fullscreen exit detected! ${
              3 - exitCount > 0 
                ? `${3 - exitCount} more warning${3 - exitCount > 1 ? 's' : ''} before auto-submit.` 
                : 'Test will be auto-submitted!'
            }`,
            { autoClose: false, toastId: 'fullscreen-warning' }
          );

          // Aggressive fullscreen re-entry
          enterFullscreen();
        }

        if (exitCount >= 3) {
          handleAutoSubmit();
          toast.error('Test auto-submitted due to multiple fullscreen exits!');
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (fullscreenRetryTimeoutRef.current) {
        clearTimeout(fullscreenRetryTimeoutRef.current);
      }
    };
  }, [submitted, enterFullscreen]);

  // Camera monitoring and permission handling
  useEffect(() => {
    if (!submitted || !hasMediaPermissions) return;

    const monitorStream = async () => {
      if (!mediaStreamRef.current) return;

      const videoTracks = mediaStreamRef.current.getVideoTracks();
      if (videoTracks.length === 0) {
        setCameraDisconnected(true);
        setStreamActive(false);
        return;
      }

      const isActive = videoTracks[0].readyState === 'live';
      setStreamActive(isActive);
      setCameraDisconnected(!isActive);

      if (!isActive) {
        toast.error("Camera disconnected! Attempting to reconnect...", {
          autoClose: false,
          toastId: 'camera-error'
        });
        try {
          await initializeCamera(currentDeviceId);
        } catch (error) {
          console.error("Camera reconnection failed:", error);
        }
      } else {
        toast.dismiss('camera-error');
      }
    };

    checkStreamIntervalRef.current = setInterval(monitorStream, 3000);
    return () => {
      clearInterval(checkStreamIntervalRef.current);
      toast.dismiss('camera-error');
    };
  }, [submitted, hasMediaPermissions, initializeCamera, currentDeviceId]);

  // Load test data
  useEffect(() => {
    const fetchTest = async () => {
      try {
        const testDoc = await getDoc(doc(db, 'tests', testId));
        if (testDoc.exists()) {
          const testData = testDoc.data();
          setTest(testData);
          setTimeLeft(testData.duration * 60);
          
          setAnswers(testData.questions.map(question => 
            question.type === 'multiple' ? [] : ''
          ));
        } else {
          toast.error('Test not found');
          navigate('/');
        }
      } catch (error) {
        console.error("Error loading test:", error);
        toast.error('Failed to load test');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTest();
  }, [testId, navigate]);

  // Timer effect
  useEffect(() => {
    if (!timeLeft || !submitted) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  // Clean up all resources
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (frameMonitorIntervalRef.current) {
        clearInterval(frameMonitorIntervalRef.current);
      }
      if (checkStreamIntervalRef.current) {
        clearInterval(checkStreamIntervalRef.current);
      }
      if (fullscreenRetryTimeoutRef.current) {
        clearTimeout(fullscreenRetryTimeoutRef.current);
      }
      toast.dismiss();
    };
  }, []);

  // Request media permissions
  const requestMediaPermissions = useCallback(async () => {
    try {
      setMediaError(null);
      await getVideoDevices();
      const success = await initializeCamera();
      
      if (success) {
        setHasMediaPermissions(true);
        startFrameMonitoring();
        await enterFullscreen();
      } else {
        throw new Error("Could not initialize camera");
      }
    } catch (error) {
      console.error("Media permission error:", error);
      toast.error(`Proctoring error: ${error.message}`);
      setHasMediaPermissions(false);
      setSubmitted(true); // Allow test to continue without camera
    }
  }, [initializeCamera, startFrameMonitoring, enterFullscreen, getVideoDevices]);

  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submitTest();
      toast.success('Test auto-submitted successfully!');
      navigate('/thank-you');
    } catch (error) {
      console.error("Auto-submit failed:", error);
      toast.error('Auto-submit failed. Please contact support.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDetails = async (e) => {
    e.preventDefault();
    if (!userDetails.name.trim() || !userDetails.email.trim() || !userDetails.batch) {
      toast.warn('Please fill all required fields');
      return;
    }
    if (!validateEmail(userDetails.email)) {
      toast.warn('Please enter a valid email address');
      return;
    }
    
    try {
      await requestMediaPermissions();
      setSubmitted(true);
    } catch (error) {
      console.error("Media permission error:", error);
      toast.error('Could not start test without camera/microphone access');
    }
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAnswerChange = (questionIndex, value) => {
    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = value;
      return newAnswers;
    });
  };

  const submitTest = async () => {
    const formattedAnswers = test.questions.map((question, index) => ({
      questionId: index,
      questionText: question.text,
      questionType: question.type,
      response: answers[index],
      correctAnswer: question.correctAnswer || null
    }));

    const testResponse = {
      testId,
      testTitle: test.title,
      userDetails,
      answers: formattedAnswers,
      submittedAt: new Date(),
      score: calculateScore(),
      totalQuestions: test.questions.length,
      timeTaken: test.duration * 60 - timeLeft,
      mediaPermissionsGranted: hasMediaPermissions,
      fullscreenExitCount: fullscreenExitCountRef.current,
      wasAutoSubmitted: fullscreenExitCountRef.current >= 3,
      cameraDisconnected
    };

    await addDoc(collection(db, 'testResponses'), testResponse);
  };

  const handleSubmitTest = async () => {
    setIsSubmitting(true);
    try {
      await submitTest();
      toast.success('Test submitted successfully!');
      navigate('/thank-you');
    } catch (error) {
      console.error("Error submitting test:", error);
      toast.error('Failed to submit test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateScore = () => {
    return test.questions.reduce((score, question, index) => {
      const userAnswer = answers[index];
      
      if (question.type === 'mcq') {
        return userAnswer === question.correctAnswer ? score + 1 : score;
      }
      
      if (question.type === 'multiple') {
        if (!Array.isArray(userAnswer)) return score;
        
        const correctSet = new Set(question.correctAnswer);
        const userSet = new Set(userAnswer);
        
        return (
          question.correctAnswer.length === userAnswer.length &&
          question.correctAnswer.every(ans => userSet.has(ans))
          ? score + 1 : score);
      }
      return score;
    }, 0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold">Test not available</h2>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (!submitted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg"
      >
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{test.title}</h2>
          <p className="text-gray-600 mt-2">Duration: {test.duration} minutes</p>
          <p className="text-sm text-yellow-600 mt-2">
            This test requires camera and microphone access for proctoring
          </p>
        </div>
        
        <form onSubmit={handleSubmitDetails} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name*</label>
            <input
              type="text"
              placeholder="As per Aadhar"
              value={userDetails.name}
              onChange={(e) => setUserDetails({...userDetails, name: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email*</label>
            <input
              type="email"
              placeholder="Your college email"
              value={userDetails.email}
              onChange={(e) => setUserDetails({...userDetails, email: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch*</label>
            <select
              value={userDetails.batch}
              onChange={(e) => setUserDetails({...userDetails, batch: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select your batch</option>
              {test.batches.map((batch, i) => (
                <option key={i} value={batch}>{batch}</option>
              ))}
            </select>
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-md hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
            >
              Start Test
            </button>
          </div>
        </form>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      {/* Webcam preview with enhanced reliability */}
      {hasMediaPermissions && (
        <div className="fixed bottom-4 right-4 z-50 w-48 h-36 bg-black rounded-lg overflow-hidden shadow-xl border-2 border-red-500">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            className="w-full h-full object-cover"
            style={{ transform: 'rotateY(180deg)' }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 text-center">
            <div className="flex items-center justify-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                streamActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              {streamActive ? 'Proctoring Active' : 'Camera Disconnected'}
            </div>
          </div>
        </div>
      )}
      
      {/* Fullscreen enforcement modal */}
      {showFullscreenWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center text-white p-6">
          <div className="bg-red-600 text-white p-6 rounded-lg max-w-md text-center">
            <h2 className="text-2xl font-bold mb-3">⚠️ Fullscreen Required</h2>
            <p className="mb-4">You must remain in fullscreen mode to continue the test.</p>
            <p className="font-medium mb-4">
              Warnings: {fullscreenExitCountRef.current}/3
            </p>
            <button
              onClick={enterFullscreen}
              className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Re-enter Fullscreen Now
            </button>
            <p className="mt-4 text-sm text-gray-300">
              Press F11 if the button doesn't work
            </p>
          </div>
        </div>
      )}
      
      {/* Main test content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl mx-auto p-6"
      >
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Test Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{test.title}</h2>
                <p className="opacity-90">Time Remaining: {formatTime(timeLeft)}</p>
                {fullscreenExitCountRef.current > 0 && (
                  <p className="text-sm mt-1 bg-white/10 px-2 py-1 rounded">
                    Fullscreen warnings: {fullscreenExitCountRef.current}/3
                  </p>
                )}
                {cameraDisconnected && (
                  <p className="text-sm mt-1 bg-red-500/80 px-2 py-1 rounded">
                    Camera disconnected - Please check your camera
                  </p>
                )}
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-full">
                <span className="font-medium">Question: {answers.filter(a => a !== '' && (!Array.isArray(a) || a.length > 0)).length}/{test.questions.length}</span>
              </div>
            </div>
          </div>
          
          {/* Questions */}
          <div className="p-6 space-y-8">
            {test.questions.map((question, qIndex) => (
              <motion.div 
                key={qIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIndex * 0.05 }}
                className="border-b border-gray-100 pb-6 last:border-0"
              >
                <div className="flex items-start">
                  <div className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
                    {qIndex + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">{question.text}</h3>
                    
                    {question.type === 'mcq' && (
                      <div className="space-y-2">
                        {question.options.map((option, oIndex) => (
                          <label key={oIndex} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="radio"
                              name={`question-${qIndex}`}
                              checked={answers[qIndex] === option}
                              onChange={() => handleAnswerChange(qIndex, option)}
                              className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {question.type === 'multiple' && (
                      <div className="space-y-2">
                        {question.options.map((option, oIndex) => (
                          <label key={oIndex} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(answers[qIndex] || []).includes(option)}
                              onChange={(e) => {
                                const currentAnswers = answers[qIndex] || [];
                                const newAnswers = e.target.checked
                                  ? [...currentAnswers, option]
                                  : currentAnswers.filter(ans => ans !== option);
                                handleAnswerChange(qIndex, newAnswers);
                              }}
                              className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {question.type === 'short' && (
                      <input
                        type="text"
                        value={answers[qIndex] || ''}
                        onChange={(e) => handleAnswerChange(qIndex, e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Type your answer here..."
                      />
                    )}
                    
                    {question.type === 'numeric' && (
                      <input
                        type="number"
                        value={answers[qIndex] || ''}
                        onChange={(e) => handleAnswerChange(qIndex, e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter a number"
                      />
                    )}
                    
                    {question.type === 'essay' && (
                      <textarea
                        value={answers[qIndex] || ''}
                        onChange={(e) => handleAnswerChange(qIndex, e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32"
                        placeholder="Write your detailed answer here..."
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSubmitTest}
                disabled={isSubmitting}
                className={`w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-md hover:from-green-600 hover:to-green-700 transition-all duration-200 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </span>
                ) : 'Submit Test'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}