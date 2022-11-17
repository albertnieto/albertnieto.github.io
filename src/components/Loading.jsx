export default function LoadingScreen() {
    return(
        <div className="bg-black12 relative flex min-h-screen flex-col justify-center overflow-hidden py-6 sm:py-12">
            <div className=" relative sm:mx-auto sm:max-w-lg sm:px-10">
                <p className="text-white12 text-5xl font-inter font-semibold">Albert Nieto</p>
                <a href="https://localhost.com/portfolio" className="text-white text-4xl font-thin font-inter">Portfolio</a>
            </div>
        </div>
    )
}