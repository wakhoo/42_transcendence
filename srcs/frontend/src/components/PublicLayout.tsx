import { Outlet } from 'react-router-dom';
import Footer from './Footer';

function PublicLayout() {
    return (
        <>
            <Outlet />
            <Footer />
        </>
    );
}

export default PublicLayout;
