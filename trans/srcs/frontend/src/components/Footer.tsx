function Footer({ className = 'bg-black' }: { className?: string }) {
    return (
        <footer className={`${className} text-center py-4 text-sm text-gray-500`}>
            <a href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</a>
            <span className="mx-2">·</span>
            <a href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</a>
        </footer>
    );
}

export default Footer;
