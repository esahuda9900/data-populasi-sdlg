import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary Uncaught Error]:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6 text-surface-100">
          <div className="card max-w-lg w-full p-8 border-red-500/30 bg-surface-900/90 shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-surface-50 tracking-tight">
                Terjadi Kendala pada Tampilan
              </h2>
              <p className="text-xs text-surface-400 leading-relaxed">
                Aplikasi mendeteksi galat saat memproses antarmuka. Anda dapat menyegarkan kembali halaman atau kembali ke beranda utama.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-surface-950 p-3 rounded-lg border border-surface-800 text-[11px] font-mono text-red-400 overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="btn-primary text-xs flex items-center justify-center gap-2 py-2.5"
              >
                <RefreshCw className="w-4 h-4" /> Segarkan Halaman
              </button>
              <button
                onClick={this.handleReset}
                className="btn-secondary text-xs flex items-center justify-center gap-2 py-2.5"
              >
                <Home className="w-4 h-4" /> Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
