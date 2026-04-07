import { useState, useRef, useCallback } from 'react'

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [recError, setRecError] = useState('')
  const recognitionRef = useRef(null)
  const restartRef = useRef(false)

  const start = useCallback(() => {
    setRecError('')
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setRecError('このブラウザは音声認識に対応していません。Chrome または Edge を使用してください。')
      return
    }

    try {
      const rec = new SpeechRecognition()
      rec.lang = 'ja-JP'
      rec.continuous = true
      rec.interimResults = true

      rec.onresult = (e) => {
        try {
          let finalText = ''
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript
            if (e.results[i].isFinal) finalText += t
            else interim += t
          }
          if (finalText) setTranscript(prev => prev + finalText)
          setInterimText(interim)
        } catch {}
      }

      rec.onerror = (e) => {
        if (e.error === 'not-allowed') {
          setRecError('マイクのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。')
          setIsRecording(false)
          restartRef.current = false
        } else if (e.error === 'no-speech') {
          // 無音は正常、無視
        } else {
          console.warn('音声認識エラー:', e.error)
        }
      }

      rec.onend = () => {
        if (restartRef.current && recognitionRef.current) {
          try { recognitionRef.current.start() } catch {}
        }
      }

      recognitionRef.current = rec
      restartRef.current = true
      setIsRecording(true)
      rec.start()
    } catch (e) {
      setRecError('録音を開始できませんでした: ' + e.message)
    }
  }, [])

  const stop = useCallback(() => {
    restartRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsRecording(false)
    setInterimText('')
  }, [])

  const reset = useCallback(() => {
    stop()
    setTranscript('')
    setInterimText('')
    setRecError('')
  }, [stop])

  return { isRecording, transcript, interimText, recError, start, stop, reset, setTranscript }
}
