'use client'
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Timer, Brain, Zap, Trophy, Loader2, Clock } from 'lucide-react';

// Define interfaces
interface Stat {
    timestamp: string;
    accuracy: number;
    wpm: number;
    score: number;
    wordCount: number;
    partialInput?: string;
}


interface DifficultySettings {
    time: number;
    multiplier: number;
    basePoints: number;
    targetLength: number;  // Target sentence length
    complexity: 'basic' | 'intermediate' | 'advanced';
}
interface HighScoreEntry {
    username: string;
    score: number;
    accuracy: number;
    wpm: number;
    timestamp: string;
}

interface HighScores {
    [key: string]: HighScoreEntry[];
}
const sentences = {
    easy: [
        "The quick brown fox jumps over the lazy dog",
        "Pack my box with five dozen liquor jugs",
        "How vexingly quick daft zebras jump",
        "The five boxing wizards jump quickly",
        "Sphinx of black quartz, judge my vow",
        "A wizard's job is to vex chumps quickly in fog",
        "The lazy painter was fixing broken quartz",
        "Jackdaws love my big sphinx of quartz",
        "Two driven jocks help fax my big quiz",
        "Five quacking zephyrs jolt my wax bed"
    ],
    medium: [
        "The mysterious old grandfather clock chimed thirteen times at midnight",
        "Scientists discovered a new species of fluorescent butterflies in the Amazon",
        "The ancient manuscript revealed secrets about medieval cooking techniques",
        "Professional skydivers performed elaborate formations during sunset",
        "Archeologists uncovered a perfectly preserved Roman mosaic beneath the city"
    ],
    hard: [
        "The quantum physicist explained the peculiarities of parallel universes to bewildered students during the symposium",
        "Environmental researchers documented the unprecedented migration patterns of Arctic wildlife amid climate changes",
        "The revolutionary artificial intelligence system demonstrated remarkable capabilities in solving complex mathematical theorems",
        "Distinguished anthropologists uncovered evidence suggesting advanced astronomical knowledge among ancient civilizations",
        "Pioneering neuroscientists identified previously unknown neural pathways responsible for processing abstract thoughts"
    ]
};

interface RealtimeMetric {
    timestamp: number;
    accuracy: number;
    wpm: number;
    partialInput: string;
}
const difficultySettings: { [key: string]: DifficultySettings } = {
    easy: { 
        time: 10, 
        multiplier: 1, 
        basePoints: 100,
        targetLength: 40,
        complexity: 'basic'
    },
    medium: { 
        time: 8, 
        multiplier: 1.5, 
        basePoints: 150,
        targetLength: 80,
        complexity: 'intermediate'
    },
    hard: { 
        time: 6, 
        multiplier: 2, 
        basePoints: 200,
        targetLength: 120,
        complexity: 'advanced'
    }
};

const generateSentence = async (difficulty: DifficultySettings) => {
    try {
        console.log('Attempting to generate sentence with settings:', {
            length: difficulty.targetLength,
            complexity: difficulty.complexity
        });

        const response = await fetch('/api/generate-sentence', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                length: difficulty.targetLength,
                complexity: difficulty.complexity
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`API error: ${data.error || response.statusText}`);
        }

        if (!data.sentence) {
            throw new Error('No sentence received from API');
        }

        return data.sentence;
    } catch (error) {
        console.error('Detailed error in generateSentence:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            difficulty,
            timestamp: new Date().toISOString()
        });

        // Fallback sentences in case API fails
        const fallbackSentences = {
            basic: "The quick brown fox jumps over the lazy dog.",
            intermediate: "The mysterious old grandfather clock chimed thirteen times at midnight.",
            advanced: "The quantum physicist explained the peculiarities of parallel universes to bewildered students."
        };
        
        return fallbackSentences[difficulty.complexity];
    }
};


const TypingChallenge: React.FC = () => {
    const [gameState, setGameState] = useState<'initial' | 'memorize' | 'type' | 'result'>('initial');
    const [currentSentence, setCurrentSentence] = useState('');
    const [userInput, setUserInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(10);
    const [accuracy, setAccuracy] = useState(0);
    const [username, setUsername] = useState('');
    const [difficulty, setDifficulty] = useState('easy');
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [wpm, setWpm] = useState(0);
    const [isPlayAgainLoading, setIsPlayAgainLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highScores, setHighScores] = useState<HighScores>({
        easy: [],
        medium: [],
        hard: []
    });
    const [stats, setStats] = useState<Stat[]>([]);
    const [wordFrequencyData, setWordFrequencyData] = useState<({ hour: string; words: number })[]>([]);
    const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
    const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetric[]>([]);
    const [lastMetricUpdate, setLastMetricUpdate] = useState<number>(0);
    const [timeoutWarning, setTimeoutWarning] = useState(false);
    const [inputTimeLeft, setInputTimeLeft] = useState<number | null>(null);
    const inputTimeoutRef = useRef<NodeJS.Timeout>();
    const warningTimeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && gameState === 'type') {
                handleSubmit();
            }
        };

        window.addEventListener('keypress', handleKeyPress);
        return () => window.removeEventListener('keypress', handleKeyPress);
    }, [gameState, userInput]);

    useEffect(() => {
        return () => {
            if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        if (gameState === 'memorize' && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && gameState === 'memorize') {
            setGameState('type');
            setStartTime(Date.now());
        }

        return () => {
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [timeLeft, gameState]);

    useEffect(() => {
        const interval = setInterval(updateWordFrequency, 60000);
        return () => clearInterval(interval);
    }, [stats]);
    
    const updateWordFrequency = () => {
        const last24Hours = stats.filter(stat => 
            new Date(stat.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        const hourlyData = Array(24).fill(0).map((_, index) => {
            const hour = new Date(Date.now() - index * 60 * 60 * 1000).getHours();
            const wordsInHour = last24Hours
                .filter(stat => new Date(stat.timestamp).getHours() === hour)
                .reduce((sum, stat) => sum + stat.wordCount, 0);

            return {
                hour: `${hour}:00`,
                words: wordsInHour
            };
        }).reverse();

        setWordFrequencyData(hourlyData);
    };

    const startGame = async () => {
        const loadingState = gameState === 'result' ? setIsPlayAgainLoading : setIsLoading;
        loadingState(true);
        try {
            const settings = difficultySettings[difficulty as keyof typeof difficultySettings];
            const generatedSentence = await generateSentence(settings);
            setCurrentSentence(generatedSentence);
            setTimeLeft(settings.time);
            setGameState('memorize');
            setUserInput('');
            setAccuracy(0);
            setWpm(0);
            setStartTime(null);
            setEndTime(null);
            setRealtimeMetrics([]);
            setTimeoutWarning(false);
            setInputTimeLeft(null);
        } catch (error) {
            console.error('Error starting game:', error);
        } finally {
            loadingState(false);
        }
    };
    const handleReturnToInitial = () => {
        setGameState('initial');
        setCurrentSentence('');
        setUserInput('');
        // Don't reset username here to preserve it
        setAccuracy(0);
        setWpm(0);
        setStartTime(null);
        setEndTime(null);
        setRealtimeMetrics([]);
        setIsLoading(false);
    };
    useEffect(() => {
        if (gameState === 'type') {
            // Set warning at 27 seconds (3 seconds before timeout)
            warningTimeoutRef.current = setTimeout(() => {
                setTimeoutWarning(true);
                setInputTimeLeft(3);
                
                // Start countdown
                const countdownInterval = setInterval(() => {
                    setInputTimeLeft(prev => {
                        if (prev === null || prev <= 1) {
                            clearInterval(countdownInterval);
                            return null;
                        }
                        return prev - 1;
                    });
                }, 1000);
                
            }, 27000);

            // Set timeout at 30 seconds
            inputTimeoutRef.current = setTimeout(() => {
                handleSubmit();
            }, 30000);
        }

        return () => {
            if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        };
    }, [gameState]);
    
    const calculateRealtimeMetrics = (input: string) => {
        if (!startTime) return;
        
        const currentTime = Date.now();
        // Only update metrics every 200ms to avoid overwhelming the UI
        if (currentTime - lastMetricUpdate < 200) return;
        
        const timeElapsed = (currentTime - startTime) / 1000;
        const words = input.trim().split(/\s+/).length;
        const wpm = Math.round((words / timeElapsed) * 60);
        
        // Calculate partial accuracy
        const chars = input.split('');
        const correctChars = chars.filter((char, index) => 
            char === currentSentence[index]
        ).length;
        const accuracy = Math.round((correctChars / chars.length) * 100) || 0;

        const newMetric: RealtimeMetric = {
            timestamp: currentTime,
            accuracy,
            wpm,
            partialInput: input
        };

        setRealtimeMetrics(prev => [...prev, newMetric]);
        setLastMetricUpdate(currentTime);
    };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newInput = e.target.value;
        setUserInput(newInput);
        calculateRealtimeMetrics(newInput);
        
        // Reset warning and timeouts if user is typing
        if (newInput.length > 0) {
            setTimeoutWarning(false);
            setInputTimeLeft(null);
            if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        }
    };


    const calculateAccuracy = () => {
        const correct = currentSentence.split('').filter((char, index) => char === userInput[index]).length;
        const total = currentSentence.length;
        return Math.round((correct / total) * 100);
    };

    const calculateWPM = (timeInSeconds: number) => {
        const words = userInput.trim().split(/\s+/).length;
        const minutes = timeInSeconds / 60;
        return Math.round(words / minutes);
    };
    const calculateScore = (accuracyScore:number, wpmScore : number , timeTaken:number ) => {
        const basePoints = difficultySettings[difficulty].basePoints;
        const timeBonus = Math.max(0, 1 - (timeTaken / 60)); // Bonus for quick completion
        const multiplier = difficultySettings[difficulty].multiplier;
        
        const score = Math.round(
        (basePoints + (accuracyScore * 2) + (wpmScore * 3)) * 
        multiplier * 
        (1 + timeBonus)
        );
    
        return {
        total: score,
        breakdown: {
            basePoints,
            accuracyPoints: Math.round(accuracyScore * 2),
            wpmPoints: Math.round(wpmScore * 3),
            timeBonus: Math.round(basePoints * timeBonus),
            multiplier
        }
        };
    };
    const renderTypingPhase = () => (
        <div className="space-y-6">
            {timeoutWarning && (
                <Alert className="bg-red-50 border-red-200">
                    <AlertDescription className="flex items-center justify-between text-red-700">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Warning: Please type within {inputTimeLeft} seconds!
                        </div>
                    </AlertDescription>
                </Alert>
            )}
            
            <Input
                type="text"
                value={userInput}
                onChange={handleInputChange}
                placeholder="Type the sentence from memory..."
                className={`w-full text-lg p-6 ${timeoutWarning ? 'border-red-500 focus:ring-red-500' : ''}`}
                autoFocus
            />
            <div className="flex justify-center">
                <Button 
                    onClick={handleSubmit}
                    className="text-lg px-8 py-6 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                >
                    Submit
                </Button>
            </div>
            
            {/* Real-time metrics display */}
            <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-white rounded-lg shadow">
                    <p className="text-lg font-semibold">Current WPM</p>
                    <p className="text-2xl text-blue-600">
                        {realtimeMetrics[realtimeMetrics.length - 1]?.wpm || 0}
                    </p>
                </div>
                
                <div className="text-center p-4 bg-white rounded-lg shadow">
                    <p className="text-lg font-semibold">Current Accuracy</p>
                    <p className="text-2xl text-purple-600">
                        {realtimeMetrics[realtimeMetrics.length - 1]?.accuracy || 0}%
                    </p>
                </div>
            </div>
            {renderStatsGraph()}
        </div>
    );
    const renderResultPhase = () => (
        <div className="space-y-6">
            {/* Current Attempt Score Card */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-1 rounded-lg shadow-lg">
                <div className="bg-white p-6 rounded-lg">
                    <h3 className="text-2xl font-bold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        Current Attempt
                    </h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-gray-600 font-semibold">Score</div>
                            <div className="text-3xl font-bold text-blue-600">
                                {stats[stats.length - 1]?.score || 0}
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-gray-600 font-semibold">Accuracy</div>
                            <div className="text-2xl font-bold text-purple-600">
                                {accuracy}%
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-gray-600 font-semibold">WPM</div>
                            <div className="text-2xl font-bold text-green-600">
                                {wpm}
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-gray-600 font-semibold">Time</div>
                            <div className="text-2xl font-bold text-orange-600">
                                {startTime && endTime ? `${((endTime - startTime) / 1000).toFixed(1)}s` : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Text Comparison */}
            <div className="space-y-4 bg-white p-6 rounded-lg shadow">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-700">Original:</div>
                        <div className="flex-1 p-3 bg-gray-50 rounded">{currentSentence}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-700">Your input:</div>
                        <div className="flex-1 p-3 bg-gray-50 rounded">{userInput}</div>
                    </div>
                </div>
            </div>

            {/* Score Breakdown Toggle */}
            <Button 
                onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800"
            >
                {showScoreBreakdown ? 'Hide Score Breakdown' : 'Show Score Breakdown'}
            </Button>

            {showScoreBreakdown && renderScoreBreakdown(stats[stats.length - 1]?.score)}

            {/* High Scores Section */}
            <div className="bg-white p-6 rounded-lg shadow">
                {renderHighScores()}
                {renderActionButtons()}
            </div>

            {/* Statistics Graphs */}
            {renderWordFrequencyGraph()}
            {stats.length > 1 && renderStatsGraph()}
        </div>
    );
    // const handleKeyPress = (e:KeyboardEvent) => {
    //     if (e.key === 'Enter' && gameState === 'type') {
    //     handleSubmit();
    //     }
    // };
    

    const handleSubmit = () => {
        const endTimeStamp = Date.now();
        if (startTime == null || userInput.trim().length === 0) return;
        setEndTime(endTimeStamp);
        
        const timeInSeconds = (endTimeStamp - startTime) / 1000;
        const accuracyScore = calculateAccuracy();
        const wpmScore = calculateWPM(timeInSeconds);
    
        setAccuracy(accuracyScore);
        setWpm(wpmScore);
    
        // Calculate score using the same function for consistency
        const scoreData = calculateScore(accuracyScore, wpmScore, timeInSeconds);
    
        // Update highscores with the consistent scoring
        setHighScores((prev) => {
            const newScore: HighScoreEntry = {
                username: username || 'Anonymous',
                score: scoreData.total,
                accuracy: accuracyScore,
                wpm: wpmScore,
                timestamp: new Date().toISOString(),
            };
            
            // Sort in descending order (highest score first)
            const newScores = [...prev[difficulty], newScore]
                .sort((a, b) => b.score - a.score)  // Changed sorting order
                .slice(0, 5);  // Keep top 5
            
            return { ...prev, [difficulty]: newScores };
        });
    
        // Update stats with the same scoring
        const newStat: Stat = {
            timestamp: new Date().toLocaleTimeString(),
            accuracy: accuracyScore,
            wpm: wpmScore,
            score: scoreData.total,  // Use the consistent score
            wordCount: userInput.trim().split(/\s+/).length
        };
    
        setStats(prev => [...prev, newStat].slice(-10));
        setGameState('result');
    };
    const renderHighScores = () => {
        const currentScore = stats[stats.length - 1]?.score;
        
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold mb-4 text-lg">High Scores ({difficulty})</h3>
                <div className="space-y-3">
                    {highScores[difficulty].map((score, index) => {
                        const isCurrentAttempt = score.score === currentScore && 
                                              score.timestamp === stats[stats.length - 1]?.timestamp;
                        
                        return (
                            <div key={index} 
                                className={`flex justify-between items-center p-3 rounded transition-colors
                                    ${index === 0 ? 'bg-yellow-50' : 'bg-gray-50'}
                                    ${isCurrentAttempt ? 'ring-2 ring-blue-500 relative' : ''}
                                    hover:bg-gray-100`}
                            >
                                {isCurrentAttempt && (
                                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-blue-500 text-white text-sm px-2 py-1 rounded-r">
                                        Current
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <div className="w-8 text-center font-bold">
                                        {index === 0 ? (
                                            <Trophy className="text-yellow-500 w-6 h-6" />
                                        ) : (
                                            <span className="text-gray-600">#{index + 1}</span>
                                        )}
                                    </div>
                                    <span className="font-medium pl-4">{score.username}</span>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${isCurrentAttempt ? 'text-blue-600' : 'text-gray-700'}`}>
                                        {score.score} points
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        WPM: {score.wpm} | Accuracy: {score.accuracy}%
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {highScores[difficulty].length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                            No high scores yet!
                        </div>
                    )}
                </div>
            </div>
        );
    };
    const renderActionButtons = () => (
        <div className="flex justify-center gap-4 pt-4">
            <Button
                onClick={handleReturnToInitial}
                className="bg-blue-500 hover:bg-blue-600 px-6 py-2"
            >
                Change Difficulty
            </Button>
            <Button 
                onClick={startGame}
                disabled={isPlayAgainLoading}
                className="bg-green-500 hover:bg-green-600 px-6 py-2"
            >
                {isPlayAgainLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                    </>
                ) : (
                    'Play Again'
                )}
            </Button>
        </div>
    );
    
    const renderStatsGraph = () => {
        const metricsData = gameState === 'result' 
            ? realtimeMetrics.map(metric => ({
                timestamp: new Date(metric.timestamp).toLocaleTimeString(),
                accuracy: metric.accuracy,
                wpm: metric.wpm
            }))
            : [];

        return (
            <div className="h-80 w-full mt-4">
                <ResponsiveContainer>
                    <LineChart data={metricsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="timestamp" 
                            interval={Math.floor(metricsData.length / 10)}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis yAxisId="left" domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} />
                        <Tooltip />
                        <Legend />
                        <Line 
                            yAxisId="left" 
                            type="monotone" 
                            dataKey="accuracy" 
                            stroke="#8884d8" 
                            name="Accuracy %" 
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line 
                            yAxisId="right" 
                            type="monotone" 
                            dataKey="wpm" 
                            stroke="#82ca9d" 
                            name="WPM"
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    };
    const renderWordFrequencyGraph = () => (
        <div className="h-80 w-full mt-4">
            <h3 className="font-bold mb-2">Words Typed (Last 24 Hours)</h3>
            <ResponsiveContainer>
                <BarChart data={wordFrequencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="hour" 
                        interval={2}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar 
                        dataKey="words" 
                        fill="#8884d8" 
                        name="Words Typed"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
    const renderScoreBreakdown = (scoreData:number) => {
        if(endTime == null || startTime == null)
            return;
        const { breakdown } = calculateScore(accuracy, wpm, (endTime - startTime) / 1000);
        
        return (
        <div className="bg-gray-50 p-4 rounded space-y-2">
            <h3 className="font-bold">Score Breakdown</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Base Points:</div>
            <div>{breakdown.basePoints}</div>
            <div>Accuracy Bonus:</div>
            <div>+{breakdown.accuracyPoints}</div>
            <div>WPM Bonus:</div>
            <div>+{breakdown.wpmPoints}</div>
            <div>Time Bonus:</div>
            <div>+{breakdown.timeBonus}</div>
            <div>Difficulty Multiplier:</div>
            <div>×{breakdown.multiplier}</div>
            <div className="font-bold">Total Score:</div>
            <div className="font-bold">{scoreData}</div>
            </div>
        </div>
        );
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-b from-white to-blue-50 p-8">
            <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                    <CardTitle className="text-center text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        Memory Typing Challenge
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                    {gameState === 'initial' && (
                        <div className="text-center space-y-6">
                            <Input
                                type="text"
                                placeholder="Enter your name..."
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="max-w-xs mx-auto text-lg"
                            />
                            <Select value={difficulty} onValueChange={setDifficulty}>
                                <SelectTrigger className="w-64 mx-auto text-lg">
                                    <SelectValue placeholder="Select difficulty" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="easy">Easy</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            <Button 
                                onClick={startGame}
                                disabled={isLoading}
                                className="text-lg px-8 py-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    'Start Game'
                                )}
                            </Button>
                        </div>
                    )}

                    {gameState === 'memorize' && (
                        <div className="text-center space-y-6">
                            <Alert className="mb-6 bg-blue-50">
                                <AlertDescription className="text-lg">
                                    Memorize this sentence: <br />
                                    <span className="font-bold text-xl mt-4 block text-blue-700">{currentSentence}</span>
                                </AlertDescription>
                            </Alert>
                            <p className="text-3xl font-bold text-blue-600">Time left: {timeLeft}s</p>
                        </div>
                    )}

                    {gameState === 'type' && renderTypingPhase()}
                    {gameState === 'result' && renderResultPhase()}
                </CardContent>
            </Card>
        </div>
    );
};
export default TypingChallenge;