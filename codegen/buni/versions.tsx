import { useState, useEffect } from 'react'
import { listVersions } from '%/buni/db'
import * as DropdownMenu from 'https://esm.sh/@radix-ui/react-dropdown-menu@2.1.1?external=react,react-dom'

export default function Versions(props: {
  filename: string
  onSelect: (version: number) => void
}) {
  const { filename, onSelect } = props
  const [versions, setVersions] = useState<number[]>([])
  useEffect(() => {
    listVersions(filename).then(setVersions)
  }, [filename])
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="text-blue-500 text-sm hover:text-blue-700">
        Versions
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {versions.map((version) => (
          <DropdownMenu.Item
            key={version}
            className="text-blue-500 text-sm hover:text-blue-700 bg-gray-50 w-10 text-center cursor-pointer"
            onClick={() => onSelect(version)}
          >
            {version}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
