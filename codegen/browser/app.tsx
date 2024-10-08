
import React, { useState } from 'react';

const defaultFiles = [
  'documents/report.pdf',
  'images/photo.jpg',
  'projects/react-app/src/index.js',
  'projects/react-app/public/index.html',
  'notes.txt'
];

export default function Component({ files = [] }: { files?: string[] }) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Function to toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Function to build the file tree structure
  const buildFileTree = (files: string[]) => {
    const tree: { [key: string]: any } = {};
    files.forEach(file => {
      const parts = file.split('/');
      let currentLevel = tree;
      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] = index === parts.length - 1 ? null : {};
        }
        currentLevel = currentLevel[part];
      });
    });
    return tree;
  };

  // Recursive component to render file/folder structure
  const FileTreeItem = ({ name, children, path }: { name: string; children: any; path: string }) => {
    const isFolder = children !== null;
    const isExpanded = expandedFolders.has(path);

    const handleClick = () => {
      if (isFolder) {
        toggleFolder(path);
      } else {
        window.open(`/edit/${path}`, '_blank');
      }
    };

    const sortedChildren = isFolder
      ? Object.entries(children).sort(([a], [b]) => a.localeCompare(b))
      : [];

    return (
      <div className="ml-4">
        <div 
          className={`flex items-center cursor-pointer hover:bg-gray-100 ${isFolder ? 'text-blue-600' : 'text-gray-700'}`}
          onClick={handleClick}
        >
          {isFolder ? (
            <span className="mr-1">{isExpanded ? '▼' : '▶'}</span>
          ) : (
            <span className="mr-1">📄</span>
          )}
          {name}
        </div>
        {isFolder && isExpanded && (
          <div className="ml-4">
            {sortedChildren.map(([childName, childChildren]) => (
              <FileTreeItem 
                key={`${path}/${childName}`}
                name={childName}
                children={childChildren}
                path={`${path}/${childName}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const fileTree = buildFileTree(files.length > 0 ? files : defaultFiles);

  const sortedRootItems = Object.entries(fileTree).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="border border-gray-300 rounded p-2">
      {sortedRootItems.map(([name, children]) => (
        <FileTreeItem key={name} name={name} children={children} path={name} />
      ))}
    </div>
  );
}
