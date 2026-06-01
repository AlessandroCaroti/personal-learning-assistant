import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
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

export function isSessionRoute(pathname: string): boolean {
  return pathname.endsWith('/quiz/sessione') || pathname.endsWith('/flashcard/sessione')
}

function hasSeenTutorial(): boolean {
  try {
    return window.localStorage?.getItem('tutorialSeen') === 'true'
  } catch {
    return true
  }
}

function OnboardingGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!hasSeenTutorial()) {
      navigate('/onboarding', { replace: true })
    }
  }, [navigate])

  return <>{children}</>
}

function useCapacitorBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    async function registerBackButton() {
      try {
        const { App } = await import('@capacitor/app')
        const listener = await App.addListener('backButton', ({ canGoBack }) => {
          if (isSessionRoute(window.location.pathname)) return

          if (canGoBack) {
            window.history.back()
          }
        })

        if (cancelled) {
          void listener.remove()
          return
        }

        cleanup = () => {
          void listener.remove()
        }
      } catch {
        cleanup = undefined
      }
    }

    void registerBackButton()

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
          <Route
            index
            element={
              <OnboardingGuard>
                <HomePage />
              </OnboardingGuard>
            }
          />
          <Route path="/onboarding" element={<TutorialPage isOnboarding />} />
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
