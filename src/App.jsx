import React, { useState, useEffect } from "react";
import { useGLTF } from '@react-three/drei'
import { OfficeCanvas } from './components/Office'
import LoadingScreen from './components/Loading'

export default function App() {
  const [loading, setLoading] = useState(true);
  useGLTF.preload("/Office.glb");

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000)
  }, [])

  return (
    loading ? <LoadingScreen /> : <OfficeCanvas />
  )
}
