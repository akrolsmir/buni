import { useEffect, useState } from 'react'
import { listVolume } from '../src/volumes'

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

  const [files, setFiles] = useState<string[]>([])
  useEffect(() => {
    fetch('/ls')
      .then((res) => res.json())
      .then((data) => setFiles(data as string[]))
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen h-full w-full bg-gray-100">
      <div className="w-full max-w-md p-6 rounded-lg shadow-md">
        <input
          type="text"
          onKeyDown={(e) => e.key === 'Enter' && generateArtifact()}
          autoFocus
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
            'Generate app'
          )}
        </button>
      </div>
      <div className="flex flex-col gap-1 w-full max-w-md p-6">
        {files
          .sort((a, b) => a.localeCompare(b))
          .map((file) => (
            <div
              key={file}
              className="overflow-hidden text-ellipsis whitespace-nowrap"
            >
              <a
                className="hover:underline text-sm text-gray-500"
                href={`/edit/${file.replace('.tsx', '')}`}
                title={file.replace('.tsx', '')}
              >
                {file.replace('.tsx', '')}
              </a>
            </div>
          ))}
      </div>
    </div>
  )
}