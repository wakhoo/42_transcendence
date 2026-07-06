import { useNavigate } from 'react-router-dom';

function HomePage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="bg-gray-900 p-10 rounded-xl flex flex-col gap-4">
                <h1 className="text-white text-3xl font-bold text-center">Transcendence</h1>
                <button
                    onClick={() => navigate('/login')} 
                    className="border border-white text-white px-6 py-2 rounded hover:bg-white hover:text-black">
                    Log in
                </button>
                <button className="border border-white text-white px-6 py-2 rounded hover:bg-white hover:text-black">sign up</button>
            </div>
        </div>
    );
}

export default HomePage;
