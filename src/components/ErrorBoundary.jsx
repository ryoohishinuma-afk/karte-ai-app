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
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 20 }}>
            <p style={{ fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>エラーが発生しました</p>
            <p style={{ fontSize: 12, color: '#b91c1c', wordBreak: 'break-all' }}>{this.state.error.message}</p>
            <button type="button" style={{ marginTop: 12, padding: '6px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
              onClick={() => this.setState({ error: null })}>再試行</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
