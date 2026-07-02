import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <div style={{ background: 'var(--accent-weak)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <p style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>エラーが発生しました</p>
            <p style={{ fontSize: 12, color: 'var(--danger)', wordBreak: 'break-all' }}>{this.state.error.message}</p>
            <button type="button" style={{ marginTop: 12, padding: '6px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
              onClick={() => this.setState({ error: null })}>再試行</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
