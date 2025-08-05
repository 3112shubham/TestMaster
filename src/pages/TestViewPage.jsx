import { useParams } from 'react-router-dom';
import { doc, collection, getDoc, getDocs, query, where, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { motion } from 'framer-motion';
import { PlusIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function TestViewPage() {
  const { testId } = useParams();
  const [test, setTest] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'mcq',
    options: ['', ''],
    correctAnswer: ''
  });
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch test details
        const testDoc = await getDoc(doc(db, 'tests', testId));
        if (testDoc.exists()) {
          setTest({ id: testDoc.id, ...testDoc.data() });
        }

        // Fetch responses
        const responsesRef = collection(db, 'testResponses');
        const q = query(responsesRef, where('testId', '==', testId));
        const responsesSnapshot = await getDocs(q);
        setResponses(responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [testId]);

  const isAnswerCorrect = (question, answer) => {
    if (!answer) return false;
    
    if (question.type === 'mcq') {
      return answer === question.correctAnswer;
    }
    if (question.type === 'multiple') {
      if (!Array.isArray(answer)) return false;
      return (
        answer.length === question.correctAnswer.length &&
        answer.every(ans => question.correctAnswer.includes(ans))
      );
    }
    return false;
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.text.trim()) {
      alert('Please enter question text');
      return;
    }

    if ((newQuestion.type === 'mcq' || newQuestion.type === 'multiple') && 
        !newQuestion.correctAnswer) {
      alert('Please select correct answer(s)');
      return;
    }

    try {
      const updatedQuestions = [...test.questions, newQuestion];
      await updateDoc(doc(db, 'tests', testId), {
        questions: updatedQuestions
      });
      setTest({ ...test, questions: updatedQuestions });
      setNewQuestion({
        text: '',
        type: 'mcq',
        options: ['', ''],
        correctAnswer: ''
      });
      setIsAddingQuestion(false);
    } catch (error) {
      console.error("Error adding question:", error);
      alert('Failed to add question');
    }
  };

  const handleDeleteQuestion = async (index) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      const updatedQuestions = test.questions.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'tests', testId), {
        questions: updatedQuestions
      });
      setTest({ ...test, questions: updatedQuestions });
    } catch (error) {
      console.error("Error deleting question:", error);
      alert('Failed to delete question');
    }
  };

  const filteredResponses = selectedBatch === 'All' 
    ? responses 
    : responses.filter(response => response.userDetails.batch === selectedBatch);

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (!test) return (
    <div className="text-center p-8">
      <h2 className="text-xl font-semibold">Test not found</h2>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{test.title}</h1>
        <div className="text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {test.questions.length} questions • {test.duration} mins
        </div>
      </div>

      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
          <Tab className={({ selected }) => `w-full py-2.5 text-sm font-medium rounded-lg transition-all ${
            selected ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-white/[0.12] hover:text-white'
          }`}>
            Test Details
          </Tab>
          <Tab className={({ selected }) => `w-full py-2.5 text-sm font-medium rounded-lg transition-all ${
            selected ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-white/[0.12] hover:text-white'
          }`}>
            Responses ({filteredResponses.length})
          </Tab>
        </Tab.List>

        <Tab.Panels className="mt-6">
          {/* Test Details Panel */}
          <Tab.Panel>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-md overflow-hidden"
            >
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">Test Information</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-blue-600">Test ID</p>
                        <p className="font-medium text-gray-700">{test.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-600">Duration</p>
                        <p className="font-medium text-gray-700">{test.duration} minutes</p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-600">Created On</p>
                        <p className="font-medium text-gray-700">
                          {test.createdAt?.toDate?.().toLocaleString() || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-5 rounded-xl border border-green-100">
                    <h3 className="text-lg font-semibold text-green-800 mb-3">Batch Information</h3>
                    <div>
                      <p className="text-sm text-green-600">Available Batches</p>
                      <ul className="mt-2 space-y-1">
                        {test.batches.map((batch, index) => (
                          <li key={index} className="font-medium text-gray-700">{batch}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 mb-8">
                  <h3 className="text-lg font-semibold text-purple-800 mb-3">Test Link</h3>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={test.testLink}
                      readOnly
                      className="flex-1 p-3 border border-gray-300 rounded-l-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(test.testLink);
                        alert('Link copied to clipboard!');
                      }}
                      className="px-4 py-3 bg-purple-600 text-white rounded-r-lg hover:bg-purple-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Questions ({test.questions.length})
                    </h3>
                    <button
                      onClick={() => setIsAddingQuestion(!isAddingQuestion)}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Add Question
                    </button>
                  </div>

                  {isAddingQuestion && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-6 border-b"
                    >
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Question Text*</label>
                          <input
                            type="text"
                            value={newQuestion.text}
                            onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter question text"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Question Type*</label>
                          <select
                            value={newQuestion.type}
                            onChange={(e) => setNewQuestion({
                              ...newQuestion, 
                              type: e.target.value,
                              correctAnswer: e.target.value === 'mcq' ? '' : []
                            })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="mcq">Multiple Choice (Single Answer)</option>
                            <option value="multiple">Multiple Choice (Multiple Answers)</option>
                            <option value="short">Short Answer</option>
                          </select>
                        </div>

                        {(newQuestion.type === 'mcq' || newQuestion.type === 'multiple') && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Options*</label>
                              {newQuestion.options.map((option, index) => (
                                <div key={index} className="flex items-center space-x-2 mb-2">
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => {
                                      const newOptions = [...newQuestion.options];
                                      newOptions[index] = e.target.value;
                                      setNewQuestion({...newQuestion, options: newOptions});
                                    }}
                                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={`Option ${index + 1}`}
                                  />
                                  <button
                                    onClick={() => {
                                      const newOptions = newQuestion.options.filter((_, i) => i !== index);
                                      setNewQuestion({
                                        ...newQuestion, 
                                        options: newOptions,
                                        correctAnswer: newQuestion.type === 'mcq' 
                                          ? (newQuestion.correctAnswer === option ? '' : newQuestion.correctAnswer)
                                          : newQuestion.correctAnswer.filter(ans => ans !== option)
                                      });
                                    }}
                                    className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition-colors"
                                    disabled={newQuestion.options.length <= 2}
                                  >
                                    <TrashIcon className="h-5 w-5" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => setNewQuestion({
                                  ...newQuestion,
                                  options: [...newQuestion.options, '']
                                })}
                                className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
                              >
                                <PlusIcon className="h-4 w-4 mr-1" />
                                Add Option
                              </button>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Correct Answer{newQuestion.type === 'multiple' ? 's*' : '*'}
                              </label>
                              {newQuestion.type === 'mcq' ? (
                                <select
                                  value={newQuestion.correctAnswer}
                                  onChange={(e) => setNewQuestion({
                                    ...newQuestion,
                                    correctAnswer: e.target.value
                                  })}
                                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="">Select correct answer</option>
                                  {newQuestion.options.map((option, index) => (
                                    <option key={index} value={option}>
                                      {option || `Option ${index + 1}`}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="space-y-2">
                                  {newQuestion.options.map((option, index) => (
                                    <label key={index} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={newQuestion.correctAnswer.includes(option)}
                                        onChange={(e) => {
                                          const newCorrectAnswers = e.target.checked
                                            ? [...newQuestion.correctAnswer, option]
                                            : newQuestion.correctAnswer.filter(ans => ans !== option);
                                          setNewQuestion({
                                            ...newQuestion,
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

                        <div className="flex justify-end space-x-3 pt-4">
                          <button
                            onClick={() => setIsAddingQuestion(false)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAddQuestion}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                          >
                            <PlusIcon className="h-4 w-4 mr-1" />
                            Add Question
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="divide-y divide-gray-200">
                    {test.questions.map((question, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-6 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-start">
                              <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                                {index + 1}
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-800">
                                  {question.text}
                                </h4>
                                <p className="text-sm text-gray-500 mt-1">
                                  Type: {question.type}
                                </p>
                              </div>
                            </div>

                            {(question.type === 'mcq' || question.type === 'multiple') && (
                              <div className="mt-4 ml-9">
                                <p className="text-sm font-medium mb-2">Options:</p>
                                <ul className="space-y-2">
                                  {question.options.map((option, optIndex) => (
                                    <li
                                      key={optIndex}
                                      className={`p-3 border rounded-lg flex items-center ${
                                        question.correctAnswer.includes(option)
                                          ? 'bg-green-50 border-green-200'
                                          : 'bg-gray-50 border-gray-200'
                                      }`}
                                    >
                                      {question.correctAnswer.includes(option) ? (
                                        <CheckIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                                      ) : (
                                        <div className="h-5 w-5 mr-2 flex-shrink-0" />
                                      )}
                                      <span className="text-gray-700">{option}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteQuestion(index)}
                            className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition-colors ml-4"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </Tab.Panel>

          {/* Responses Panel */}
          <Tab.Panel>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-800">Test Responses</h3>
                  <div className="flex items-center space-x-4">
                    <label className="text-sm text-gray-600">Filter by Batch:</label>
                    <select
                      value={selectedBatch}
                      onChange={(e) => setSelectedBatch(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="All">All Batches</option>
                      {test.batches.map((batch, index) => (
                        <option key={index} value={batch}>{batch}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredResponses.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No responses found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Batch
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Percentage
                          </th>
                          {test.questions.map((_, index) => (
                            <th key={index} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Q{index + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredResponses.map((response) => (
                          <tr key={response.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {response.userDetails.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {response.userDetails.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                {response.userDetails.batch}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                response.score / response.totalQuestions >= 0.7 
                                  ? 'bg-green-100 text-green-800'
                                  : response.score / response.totalQuestions >= 0.4
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                              }`}>
                                {response.score}/{response.totalQuestions}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                response.score / response.totalQuestions >= 0.7 
                                  ? 'bg-green-100 text-green-800'
                                  : response.score / response.totalQuestions >= 0.4
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                              }`}>
                                {100*response.score/response.totalQuestions} %
                              </span>
                            </td>
                            {test.questions.map((question, qIndex) => {
                              let answer;
                              if (Array.isArray(response.answers)) {
                                answer = response.answers[qIndex];
                              } else {
                                answer = response.answers[`q${qIndex}`] || response.answers[qIndex];
                              }
                              
                              const answerValue = answer?.response || answer?.value || answer;
                              const correct = isAnswerCorrect(question, answerValue);
                              
                              return (
                                <td key={qIndex} className="px-3 py-4 whitespace-nowrap text-center">
                                  {question.type === 'mcq' || question.type === 'multiple' ? (
                                    <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${
                                      correct ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'
                                    }`}>
                                      {correct ? <CheckIcon className="h-4 w-4" /> : <XMarkIcon className="h-4 w-4" />}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}