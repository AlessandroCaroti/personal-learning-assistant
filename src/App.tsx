import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { FlashcardConfigPage } from './pages/FlashcardConfigPage'
import { FlashcardSessionPage } from './pages/FlashcardSessionPage'
import { HomePage } from './pages/HomePage'
import { QuizConfigPage } from './pages/QuizConfigPage'
import { QuizResultPage } from './pages/QuizResultPage'
import { QuizSessionPage } from './pages/QuizSessionPage'
import { SummaryPage } from './pages/SummaryPage'
import { TutorialPage } from './pages/TutorialPage'

function useCapacitorBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        }
      }).then((listener) => {
        if (cancelled) {
          void listener.remove()
          return
        }

        cleanup = () => {
          void listener.remove()
        }
      })
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])
}

export default function App() {
  useCapacitorBackButton()

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/guida" element={<TutorialPage />} />
          <Route path="/esame/:examId" element={<DashboardPage />} />
          <Route path="/esame/:examId/riassunto" element={<SummaryPage />} />
          <Route path="/esame/:examId/quiz/config" element={<QuizConfigPage />} />
          <Route path="/esame/:examId/quiz/sessione" element={<QuizSessionPage />} />
          <Route path="/esame/:examId/quiz/risultato" element={<QuizResultPage />} />
          <Route path="/esame/:examId/flashcard/config" element={<FlashcardConfigPage />} />
          <Route path="/esame/:examId/flashcard/sessione" element={<FlashcardSessionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
