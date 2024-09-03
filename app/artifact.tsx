import { useState } from 'react'

// Centered single input which takes in a prompt like "a todo list"
// On submit, generates an artifact using Claude Sonnet
export default function Artifact() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  // On submit, generate the artifact by calling the /generate endpoint
  function generateArtifact() {
    setGenerating(true)
    fetch('/generate', {
      method: 'POST',
      body: prompt,
    })
      .then((res) => res.json())
      .then((data) => {
        // Instead, navigate to the generated artifact
        window.location.href = data.url
      })
      .finally(() => setGenerating(false))
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full px-4 py-2 mb-4 text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter a prompt..."
        />
        <button
          onClick={generateArtifact}
          className="w-full px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
          disabled={generating}
        >
          {generating ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating...
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>
    </div>
  )
}
