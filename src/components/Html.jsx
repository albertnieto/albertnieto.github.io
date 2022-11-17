import { useThree } from '@react-three/fiber'
import { Scroll } from '@react-three/drei'


function Home() {
  return(
    <>
      <p className="text-white12 text-5xl font-inter font-semibold">Albert Nieto</p>
      <p className="text-white12 text-4xl font-inter font-normal">Developer</p>
    </>
  )
}

function About() {
  return(
    "About"
  )
}

function Projects() {
  return(
    "Projects"
  )
}

function Tools() {
  return(
    "Tools"
  )
}

function Contact() {
  return(
    "Contact"
  )
}

function Resume() {
  return(
    "Resume"
  )
}

function AIArt() {
  return(
    "AIArt"
  )
}

export default function Html() {
  const { width: w, height: h } = useThree((state) => state.viewport)
  return (
    <Scroll html>
      <Home position={[1, 0, 0]}/>
      <About />
      <Projects />
      <Tools />
      <Contact />
      <Resume />
      <AIArt />
    </Scroll>
  )
}