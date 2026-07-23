import { useNavigate } from 'react-router-dom';
import { OtpVerifyForm } from '../components/OtpVerifyForm';

function GoogleTwoFactorPage() {
    const navigate = useNavigate();
    const partialToken = new URLSearchParams(window.location.search).get('partialToken');

    if (!partialToken) {
        navigate('/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="bg-gray-900 p-10 rounded-xl flex flex-col gap-4">
                <h1 className="text-white text-3xl font-bold text-center">Ft_Skribbl</h1>
                <OtpVerifyForm
                    partialToken={partialToken}
                    onVerified={(tokens) => {
                        sessionStorage.setItem('token', tokens.accessToken);
                        navigate('/dashboard');
                    }}
                    onCancel={() => navigate('/login')}
                />
            </div>
        </div>
    );
}

export default GoogleTwoFactorPage;
