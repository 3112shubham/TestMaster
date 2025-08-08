import { useState } from 'react';
import { db } from '../firebase';  // Make sure this path is correct
import { doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { motion } from 'framer-motion';
export default function CreateTestForm({ onTestCreated }) {
  const [testTitle, setTestTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    text: '',
    type: 'mcq',
    options: ['', ''],
    correctAnswer: ''
  });
  const [activeTab, setActiveTab] = useState('details');

  const batchOptions = ['Tapasya Campus T1','Tapasya Campus T2','Tapasya Campus T3','Tapasya Campus T4'
,'Tapasya Campus T5'
,'Dhruv Campus D1'
,'Dhruv Campus D2'
,'Dhruv Campus D3'
,'Dhruv Campus D4'
,'Abhinavan Campus A8'
,'Abhinavan Campus A9'
,'Abhinavan Campus A1'
,'Abhinavan Campus A2'
,'Abhinavan Campus A3'
,'Abhinavan Campus A4'
,'Abhinavan Campus A5'
,'Abhinavan Campus A6'
,'Abhinavan Campus A7'];

  const handleAddQuestion = () => {
    if (!currentQuestion.text) {
      alert('Please enter question text');
      return;
    }

    if ((currentQuestion.type === 'mcq' || currentQuestion.type === 'multiple') && 
        !currentQuestion.correctAnswer) {
      alert('Please select correct answer(s)');
      return;
    }

    setQuestions([...questions, currentQuestion]);
    setCurrentQuestion({
      text: '',
      type: 'mcq',
      options: ['', ''],
      correctAnswer: ''
    });
    setActiveTab('preview');
  };

  const handleCreateTest = async () => {
  // Validation
  if (!testTitle.trim()) {
    alert('Please enter a valid test title');
    return;
  }

  if (questions.length === 0) {
    alert('Please add at least one question');
    return;
  }

  const testId = uuidv4();
  const testData = {
    title: testTitle.trim(),
    duration: Number(duration), // Ensure it's a number
    batches: selectedBatches,
    questions: questions.map(q => ({
      ...q,
      // Ensure options and correctAnswer are properly formatted
      options: q.options?.map(opt => opt.trim()).filter(opt => opt) || [],
      correctAnswer: Array.isArray(q.correctAnswer) 
        ? q.correctAnswer.map(ans => ans.trim()).filter(ans => ans)
        : q.correctAnswer?.trim()
    })),
    createdAt: new Date(),
    testLink: `${window.location.origin}/test/${testId}`
  };

  try {
    console.log('Attempting to create test with data:', testData);
    
    // Validate Firestore connection
    if (!db) {
      throw new Error('Firestore database not initialized');
    }

    await setDoc(doc(db, 'tests', testId), testData);
    console.log('Test created successfully with ID:', testId);
    
    // Reset form after successful creation
    setTestTitle('');
    setDuration(30);
    setSelectedBatches([]);
    setQuestions([]);
    
    
  } catch (error) {
    console.error("Detailed error creating test:", {
      error,
      testData,
      firestoreConfig: db?.app?.options // Log Firebase config (without sensitive data)
    });
    
    alert(`Failed to create test: ${error.message || 'Unknown error'}`);
  }
  alert('Test created successfully!');
};

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('details')}
            className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'details' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Test Details
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'questions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            disabled={!testTitle}
          >
            Add Questions
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'preview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            disabled={questions.length === 0}
          >
            Test Preview
          </button>
        </nav>
      </div>

      {/* Test Details Section */}
      {activeTab === 'details' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Test Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Title*</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  required
                  placeholder="Enter test title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)*</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    required
                  />
                  <span className="absolute right-3 top-3 text-gray-400">mins</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Assign to Batches*</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {batchOptions.map((batch) => (
                <motion.label 
                  key={batch}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                >
                  <input
                    type="checkbox"
                    checked={selectedBatches.includes(batch)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBatches([...selectedBatches, batch]);
                      } else {
                        setSelectedBatches(selectedBatches.filter(b => b !== batch));
                      }
                    }}
                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 text-gray-700">{batch}</span>
                </motion.label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setActiveTab('questions')}
              disabled={!testTitle}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Next: Add Questions
            </button>
          </div>
        </motion.div>
      )}

      {/* Add Questions Section */}
      {activeTab === 'questions' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold mb-6 text-gray-800">Add New Question</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Text*</label>
              <textarea
                value={currentQuestion.text}
                onChange={(e) => setCurrentQuestion({...currentQuestion, text: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 min-h-[100px]"
                required
                placeholder="Enter your question"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Type*</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {['mcq', 'multiple', 'short', 'numeric', 'essay'].map((type) => (
                  <motion.button
                    key={type}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setCurrentQuestion({
                      ...currentQuestion, 
                      type,
                      correctAnswer: type === 'mcq' ? '' : []
                    })}
                    className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${currentQuestion.type === type ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {type === 'mcq' && 'Single Choice'}
                    {type === 'multiple' && 'Multiple Choice'}
                    {type === 'short' && 'Short Answer'}
                    {type === 'numeric' && 'Numeric'}
                    {type === 'essay' && 'Essay'}
                  </motion.button>
                ))}
              </div>
            </div>

            {(currentQuestion.type === 'mcq' || currentQuestion.type === 'multiple') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options*</label>
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, index) => (
                      <motion.div 
                        key={index}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center space-x-2"
                      >
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...currentQuestion.options];
                              newOptions[index] = e.target.value;
                              setCurrentQuestion({...currentQuestion, options: newOptions});
                            }}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 pr-10"
                            placeholder={`Option ${index + 1}`}
                          />
                          {currentQuestion.correctAnswer === option || 
                           (Array.isArray(currentQuestion.correctAnswer) && 
                            currentQuestion.correctAnswer.includes(option)) ? (
                            <span className="absolute right-3 top-3 text-green-500">
                              ✓
                            </span>
                          ) : null}
                        </div>
                        <button
                          onClick={() => {
                            const newOptions = currentQuestion.options.filter((_, i) => i !== index);
                            setCurrentQuestion({
                              ...currentQuestion, 
                              options: newOptions,
                              correctAnswer: currentQuestion.type === 'mcq' 
                                ? (currentQuestion.correctAnswer === option ? '' : currentQuestion.correctAnswer)
                                : currentQuestion.correctAnswer.filter(ans => ans !== option)
                            });
                          }}
                          className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition-colors duration-200"
                          disabled={currentQuestion.options.length <= 2}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentQuestion({
                      ...currentQuestion,
                      options: [...currentQuestion.options, '']
                    })}
                    className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Option
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correct Answer{currentQuestion.type === 'multiple' ? 's*' : '*'}
                  </label>
                  {currentQuestion.type === 'mcq' ? (
                    <select
                      value={currentQuestion.correctAnswer}
                      onChange={(e) => setCurrentQuestion({
                        ...currentQuestion,
                        correctAnswer: e.target.value
                      })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    >
                      <option value="">Select correct answer</option>
                      {currentQuestion.options.map((option, index) => (
                        <option key={index} value={option}>
                          {option || `Option ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      {currentQuestion.options.map((option, index) => (
                        <label key={index} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                          <input
                            type="checkbox"
                            checked={currentQuestion.correctAnswer.includes(option)}
                            onChange={(e) => {
                              const newCorrectAnswers = e.target.checked
                                ? [...currentQuestion.correctAnswer, option]
                                : currentQuestion.correctAnswer.filter(ans => ans !== option);
                              setCurrentQuestion({
                                ...currentQuestion,
                                correctAnswer: newCorrectAnswers
                              });
                            }}
                            className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                          />
                          <span className="ml-3 text-gray-700">{option || `Option ${index + 1}`}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-8">
            <button
              onClick={() => setActiveTab('details')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
            >
              Back
            </button>
            <button
              onClick={handleAddQuestion}
              disabled={!currentQuestion.text}
              className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Add Question
            </button>
          </div>
        </motion.div>
      )}

      {/* Test Preview Section */}
      {activeTab === 'preview' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-100"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Test Preview</h3>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
              {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
            </span>
          </div>

          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
            {questions.map((q, index) => (
              <motion.div 
                key={index}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors duration-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">
                      <span className="text-blue-600">{index + 1}.</span> {q.text}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Type: <span className="capitalize">{q.type}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setQuestions(questions.filter((_, i) => i !== index));
                    }}
                    className="p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setActiveTab('questions')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
            >
              Add More Questions
            </button>
            <button
              onClick={handleCreateTest}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Create Test
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}