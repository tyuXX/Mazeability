let maze = [];
let cellSize = 0;
let svgNS = "http://www.w3.org/2000/svg";

// Function to generate maze data without rendering
async function generateMazeData(seed, rows, cols) {
  const maze = Array.from({ length: rows }, () => Array(cols).fill(0));
  const random = seedrandom(seed);
  const stack = [];
  const startX = 1;
  const startY = 1;
  
  // Mark the starting cell as part of the maze
  maze[startY][startX] = 1;
  stack.push([startX, startY]);
  
  // Generate maze using depth-first search
  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1];
    const directions = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    
    directions.sort(() => random() - 0.5);
    let carved = false;
    
    for (const [dx, dy] of directions) {
      const nx = x + dx * 2;
      const ny = y + dy * 2;
      
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && maze[ny][nx] === 0) {
        maze[y + dy][x + dx] = 1;
        maze[ny][nx] = 1;
        stack.push([nx, ny]);
        carved = true;
        break;
      }
    }
    
    if (!carved) {
      stack.pop();
    }
  }
  
  return { maze, startX, startY, endX: cols - 2, endY: rows - 2 };
}

// Function to generate SVG string with optimized wall rectangles
async function generateSVGString(mazeData, optimize = true) {
  const { maze, startX, startY, endX, endY } = mazeData;
  const rows = maze.length;
  const cols = maze[0].length;
  
  const chunks = [];
  const addChunk = (chunk) => chunks.push(chunk);
  
  // Add SVG header
  addChunk(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${cols * 10}" height="${rows * 10}" viewBox="0 0 ${cols} ${rows}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff"/>
`);

  // Function to find the maximum width of a horizontal wall starting at (x,y)
  function getHorizontalWallWidth(x, y) {
    let width = 0;
    while (x + width < cols && maze[y][x + width] === 0) {
      width++;
    }
    return width;
  }

  // Function to find the maximum height of a vertical wall starting at (x,y)
  function getVerticalWallHeight(x, y) {
    let height = 0;
    while (y + height < rows && maze[y + height][x] === 0) {
      height++;
    }
    return height;
  }

  // If optimization is disabled, use simple rendering
  if (!optimize) {
    // Simple rendering without optimization
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (maze[y][x] === 0) {
          addChunk(`<rect x="${x}" y="${y}" width="1" height="1" fill="#000000"/>`);
        }
      }
    }
    
    // Add start and end points
    addChunk(`<rect x="${startX}" y="${startY}" width="1" height="1" fill="#00ff00"/>`);
    addChunk(`<rect x="${endX}" y="${endY}" width="1" height="1" fill="#ff0000"/>`);
    
    // Close SVG
    addChunk('</svg>');
    return chunks.join('\n');
  }

  // Track visited cells to avoid processing the same wall multiple times
  const visited = Array(rows).fill().map(() => Array(cols).fill(false));
  let wallCount = 0;
  let rectCount = 0;
  let totalWalls = 0;

  // First pass: count total walls for progress tracking
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (maze[y][x] === 0) totalWalls++;
    }
  }

  // Process the maze to find and group walls
  for (let y = 0; y < rows; y++) {
    // Update status every 10 rows
    if (y % 10 === 0) {
      const progress = Math.round((y * cols) / (rows * cols) * 100);
      await updateStatus(`Optimizing walls... ${progress}%`);
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    for (let x = 0; x < cols; x++) {
      // Skip if not a wall or already visited
      if (maze[y][x] !== 0 || visited[y][x]) continue;
      wallCount++;

      // Try to create a horizontal wall (preferred for mazes)
      const hWidth = getHorizontalWallWidth(x, y);
      if (hWidth > 1) {
        // Check if we can make a rectangle by checking rows below
        let maxHeight = 1;
        let canExtendDown = true;
        
        while (canExtendDown && y + maxHeight < rows) {
          for (let wx = x; wx < x + hWidth; wx++) {
            if (maze[y + maxHeight][wx] !== 0 || visited[y + maxHeight][wx]) {
              canExtendDown = false;
              break;
            }
          }
          if (canExtendDown) maxHeight++;
        }

        // Add the rectangle
        addChunk(`<rect x="${x}" y="${y}" width="${hWidth}" height="${maxHeight}" fill="#000000"/>`);
        
        // Mark these cells as visited
        for (let wy = y; wy < y + maxHeight; wy++) {
          for (let wx = x; wx < x + hWidth; wx++) {
            visited[wy][wx] = true;
          }
        }
        
        rectCount++;
        continue;
      }

      // If no horizontal wall, try vertical
      const vHeight = getVerticalWallHeight(x, y);
      if (vHeight > 1) {
        addChunk(`<rect x="${x}" y="${y}" width="1" height="${vHeight}" fill="#000000"/>`);
        
        // Mark these cells as visited
        for (let wy = y; wy < y + vHeight; wy++) {
          visited[wy][x] = true;
        }
        
        rectCount++;
        continue;
      }

      // Single cell wall
      addChunk(`<rect x="${x}" y="${y}" width="1" height="1" fill="#000000"/>`);
      visited[y][x] = true;
      rectCount++;
    }
  }

  // Add start and end points
  addChunk(`<rect x="${startX}" y="${startY}" width="1" height="1" fill="#00ff00"/>`);
  addChunk(`<rect x="${endX}" y="${endY}" width="1" height="1" fill="#ff0000"/>`);
  
  // Close SVG
  addChunk('</svg>');
  
  console.log(`Optimized ${wallCount} walls into ${rectCount} rectangles (${Math.round((1 - (rectCount / wallCount)) * 100)}% reduction)`);
  return chunks.join('\n');
}

// Initialize with default maze after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  generateMaze(
    document.getElementById("seedInput").value || Math.floor(Date.now() / 1000).toString(),
    50,
    50
  );
});

function seedrandom(seed) {
  let m = 0x80000000,
    a = 1103515245,
    c = 12345;
  let seedValue = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return function () {
    seedValue = (a * seedValue + c) % m;
    return seedValue / m;
  };
}

function updateStatus(message) {
  document.getElementById("statusLabel").textContent = message;
  // Force UI update by briefly yielding to the browser
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function generateMaze(seed, rows, cols) {
  // Use memory-efficient mode if enabled
  if (isMemoryEfficientMode()) {
    return generateMazeEfficient(seed, rows, cols);
  }
  
  // Original implementation
  await updateStatus(`Generating maze (${rows}×${cols})...`);
  const svg = document.getElementById("mazeSvg");
  
  // Clear previous maze
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
  
  // Set viewBox to fit the maze with some padding
  const padding = 1;
  const viewBoxSize = Math.max(rows, cols) + padding * 2;
  svg.setAttribute("viewBox", `0 0 ${viewBoxSize} ${viewBoxSize}`);
  
  // Create a background rectangle
  const bg = document.createElementNS(svgNS, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#fff");
  svg.appendChild(bg);
  
  maze = Array.from({ length: rows }, () => Array(cols).fill(0));
  const random = seedrandom(seed);
  const stack = [];
  const startX = 1;
  const startY = 1;
  const endX = cols - 2;
  const endY = rows - 2;
  
  stack.push([startX, startY]);
  maze[startY][startX] = 1;

  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1];
    const directions = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    directions.sort(() => random() - 0.5);

    let carved = false;
    for (const [dx, dy] of directions) {
      const nx = x + dx * 2,
            ny = y + dy * 2;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && maze[ny][nx] === 0) {
        maze[y + dy][x + dx] = 1;
        maze[ny][nx] = 1;
        stack.push([nx, ny]);
        carved = true;
        break;
      }
    }

    if (!carved) {
      stack.pop();
    }
  }

  await updateStatus("Preparing maze visualization...");
  const startTime = performance.now();
  
  // Clear and set up the SVG
  svg.innerHTML = '';
  
  // Add background
  const background = document.createElementNS(svgNS, 'rect');
  background.setAttribute('width', '100%');
  background.setAttribute('height', '100%');
  background.setAttribute('fill', '#fff');
  svg.appendChild(background);
  
  // Create groups for walls and points
  const wallsGroup = document.createElementNS(svgNS, 'g');
  wallsGroup.setAttribute('fill', '#000');
  const pointsGroup = document.createElementNS(svgNS, 'g');
  
  // Process walls in batches to avoid memory issues
  
  const generationStartTime = performance.now();
  const optimize = isWallOptimizationEnabled();
  
  if (optimize) {
    // Use optimized wall rendering
    await updateStatus("Optimizing walls...");
    const optimizedWalls = await getOptimizedWalls(maze);
    
    // Add optimized walls to SVG
    optimizedWalls.forEach(wall => {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', wall.x);
      rect.setAttribute('y', wall.y);
      rect.setAttribute('width', wall.width);
      rect.setAttribute('height', wall.height);
      wallsGroup.appendChild(rect);
    });
  } else {
    // Original wall rendering (one rect per wall cell)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (maze[y][x] === 0) {
          const wall = document.createElementNS(svgNS, 'rect');
          wall.setAttribute('x', x);
          wall.setAttribute('y', y);
          wall.setAttribute('width', 1);
          wall.setAttribute('height', 1);
          wallsGroup.appendChild(wall);
        }
      }
    }
  }
  
  // Add walls to SVG
  svg.appendChild(wallsGroup);
  
  // Add start point
  const start = document.createElementNS(svgNS, 'rect');
  start.setAttribute('x', startX);
  start.setAttribute('y', startY);
  start.setAttribute('width', 1);
  start.setAttribute('height', 1);
  start.setAttribute('fill', 'green');
  pointsGroup.appendChild(start);
  
  // Add end point
  const end = document.createElementNS(svgNS, 'rect');
  end.setAttribute('x', endX);
  end.setAttribute('y', endY);
  end.setAttribute('width', 1);
  end.setAttribute('height', 1);
  end.setAttribute('fill', 'red');
  pointsGroup.appendChild(end);
  
  // Add points to SVG
  svg.appendChild(pointsGroup);

  await updateStatus(`Maze generated in ${((performance.now() - generationStartTime) / 1000).toFixed(1)}s`);
  return { maze, cellSize: 1 };
}

// Helper function to get optimized walls for rendering
async function getOptimizedWalls(maze) {
  const rows = maze.length;
  const cols = maze[0].length;
  const visited = Array(rows).fill().map(() => Array(cols).fill(false));
  const walls = [];
  
  // Function to find the maximum width of a horizontal wall starting at (x,y)
  function getHorizontalWallWidth(x, y) {
    let width = 0;
    while (x + width < cols && maze[y][x + width] === 0) {
      width++;
    }
    return width;
  }
  
  for (let y = 0; y < rows; y++) {
    // Update status every 10 rows
    if (y % 10 === 0) {
      await updateStatus(`Optimizing walls... ${Math.round((y / rows) * 100)}%`);
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    for (let x = 0; x < cols; x++) {
      // Skip if not a wall or already visited
      if (maze[y][x] !== 0 || visited[y][x]) continue;
      
      // Try to create a horizontal wall (preferred for mazes)
      const width = getHorizontalWallWidth(x, y);
      if (width > 0) {
        // Check if we can make a rectangle by checking rows below
        let height = 1;
        let canExtendDown = true;
        
        while (canExtendDown && y + height < rows) {
          for (let wx = x; wx < x + width; wx++) {
            if (maze[y + height][wx] !== 0 || visited[y + height][wx]) {
              canExtendDown = false;
              break;
            }
          }
          if (canExtendDown) height++;
        }
        
        // Add the rectangle
        walls.push({ x, y, width, height });
        
        // Mark these cells as visited
        for (let wy = y; wy < y + height; wy++) {
          for (let wx = x; wx < x + width; wx++) {
            visited[wy][wx] = true;
          }
        }
      }
    }
  }
  
  return walls;
}

function solveMaze(maze, startX, startY, endX, endY) {
  document.getElementById("statusLabel").textContent = "Solving maze...";
  const svg = document.getElementById("mazeSvg");
  const stack = [[startX, startY]];
  const visited = new Set();
  const path = [];
  const directions = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];

  // Clear any existing solution
  const oldSolution = document.querySelectorAll(".solution");
  oldSolution.forEach(el => el.remove());

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x === endX && y === endY) {
      // Draw the solution path
      const solutionPath = document.createElementNS(svgNS, "path");
      let pathData = `M ${x + 0.5} ${y + 0.5} `;
      
      for (const [px, py] of path) {
        pathData += `L ${px + 0.5} ${py + 0.5} `;
      }
      
      solutionPath.setAttribute("d", pathData);
      solutionPath.setAttribute("stroke", "blue");
      solutionPath.setAttribute("stroke-width", "0.2");
      solutionPath.setAttribute("fill", "none");
      solutionPath.setAttribute("class", "solution");
      solutionPath.setAttribute("stroke-linecap", "round");
      solutionPath.setAttribute("stroke-linejoin", "round");
      svg.appendChild(solutionPath);
      
      document.getElementById("statusLabel").textContent = "Idle.";
      return path;
    }
    
    if (!visited.has(`${x},${y}`)) {
      visited.add(`${x},${y}`);
      path.push([x, y]);
      
      for (const [dx, dy] of directions) {
        const nx = x + dx,
              ny = y + dy;
        
        if (nx >= 0 && ny >= 0 && nx < maze[0].length && ny < maze.length && maze[ny][nx] === 1) {
          stack.push([nx, ny]);
        }
      }
    }
    
    if (path.length > 0) {
      path.pop();
    }
  }
  
  document.getElementById("statusLabel").textContent = "No solution found.";
  return [];
}

function exportAsSvg() {
  document.getElementById("statusLabel").textContent = "Exporting .svg...";
  const svg = document.getElementById("mazeSvg");
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svg);
  
  // Add XML declaration and doctype
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  
  // Convert to blob and create download link
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
  const link = document.createElement("a");
  link.href = url;
  link.download = "maze.svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  document.getElementById("statusLabel").textContent = "Idle.";
}

document.getElementById("generateButton").addEventListener("click", async () => {
  const button = document.getElementById("generateButton");
  const originalText = button.textContent;
  
  try {
    button.disabled = true;
    button.textContent = "Generating...";
    
    const seed = document.getElementById("seedInput").value ||
                Math.floor(Date.now() / 1000).toString();
    const rows = parseInt(document.getElementById("rowsInput").value);
    const cols = parseInt(document.getElementById("colsInput").value);
    
    await generateMaze(seed, rows, cols);
  } catch (error) {
    console.error("Error generating maze:", error);
    updateStatus("Error generating maze");
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
});

document.getElementById("solveButton").addEventListener("click", () => {
  const rows = parseInt(document.getElementById("rowsInput").value);
  const cols = parseInt(document.getElementById("colsInput").value);
  const startX = 1;
  const startY = 1;
  const endX = cols - 2;
  const endY = rows - 2;
  solveMaze(maze, startX, startY, endX, endY);
});

document.getElementById("exportSvgButton").addEventListener("click", exportAsSvg);

// Function to check if wall optimization is enabled
function isWallOptimizationEnabled() {
  return document.getElementById("optimizeWalls").checked;
}

// Function to check if memory efficient mode is enabled
function isMemoryEfficientMode() {
  return document.getElementById("memoryEfficient")?.checked || false;
}

// Memory-efficient maze generation using Uint8Array and bitwise operations
async function generateMazeEfficient(seed, rows, cols) {
  await updateStatus(`Generating maze (${rows}×${cols}) in memory-efficient mode...`);
  const svg = document.getElementById("mazeSvg");
  
  // Clear previous maze
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
  
  // Set viewBox to fit the maze with some padding
  const padding = 1;
  const viewBoxSize = Math.max(rows, cols) + padding * 2;
  svg.setAttribute("viewBox", `0 0 ${viewBoxSize} ${viewBoxSize}`);
  
  // Create a background rectangle
  const bg = document.createElementNS(svgNS, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#fff");
  svg.appendChild(bg);
  
  // Use Uint8Array for more efficient memory usage
  const maze = new Uint8Array(rows * cols);
  const random = seedrandom(seed);
  const stack = [];
  const startX = 1;
  const startY = 1;
  const endX = cols - 2;
  const endY = rows - 2;
  
  // Helper function to get/set maze cells
  const getCell = (x, y) => maze[y * cols + x];
  const setCell = (x, y, value) => maze[y * cols + x] = value;
  
  // Mark starting cell
  setCell(startX, startY, 1);
  stack.push([startX, startY]);
  
  // Generate maze using depth-first search with batching
  const batchSize = 100; // Process this many cells before yielding
  let processed = 0;
  
  async function processBatch() {
    const batchStartTime = performance.now();
    let batchProcessed = 0;
    
    while (stack.length > 0 && batchProcessed < batchSize) {
      const [x, y] = stack[stack.length - 1];
      const directions = [
        [0, 1], [1, 0], [0, -1], [-1, 0]
      ];
      
      // Shuffle directions
      for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
      }
      
      let carved = false;
      for (const [dx, dy] of directions) {
        const nx = x + dx * 2;
        const ny = y + dy * 2;
        
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && getCell(nx, ny) === 0) {
          setCell(x + dx, y + dy, 1);
          setCell(nx, ny, 1);
          stack.push([nx, ny]);
          carved = true;
          break;
        }
      }
      
      if (!carved) {
        stack.pop();
      }
      
      batchProcessed++;
      processed++;
      
      // Update status every 1000 cells
      if (processed % 1000 === 0) {
        const progress = Math.min(100, Math.floor((processed / (rows * cols)) * 100));
        await updateStatus(`Generating maze... ${progress}%`);
      }
    }
    
    // If there's more to process, schedule next batch
    if (stack.length > 0) {
      // Use setTimeout to allow UI updates between batches
      return new Promise(resolve => {
        setTimeout(() => {
          processBatch().then(resolve);
        }, 0);
      });
    }
    return Promise.resolve();
  }
  
  // Process the maze in batches
  await processBatch();
  
  // Render the maze
  await updateStatus("Rendering maze...");
  const renderStartTime = performance.now();
  
  // Create groups for walls and points
  const wallsGroup = document.createElementNS(svgNS, 'g');
  wallsGroup.setAttribute('fill', '#000');
  const pointsGroup = document.createElementNS(svgNS, 'g');
  
  // Render walls
  if (isWallOptimizationEnabled()) {
    // Use optimized wall rendering
    const optimizedWalls = await getOptimizedWallsUint8(maze, rows, cols);
    optimizedWalls.forEach(wall => {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', wall.x);
      rect.setAttribute('y', wall.y);
      rect.setAttribute('width', wall.width);
      rect.setAttribute('height', wall.height);
      wallsGroup.appendChild(rect);
    });
  } else {
    // Original wall rendering (one rect per wall cell)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (getCell(x, y) === 0) {
          const wall = document.createElementNS(svgNS, 'rect');
          wall.setAttribute('x', x);
          wall.setAttribute('y', y);
          wall.setAttribute('width', 1);
          wall.setAttribute('height', 1);
          wallsGroup.appendChild(wall);
        }
      }
    }
  }
  
  // Add walls to SVG
  svg.appendChild(wallsGroup);
  
  // Add start and end points
  const start = document.createElementNS(svgNS, 'rect');
  start.setAttribute('x', startX);
  start.setAttribute('y', startY);
  start.setAttribute('width', 1);
  start.setAttribute('height', 1);
  start.setAttribute('fill', 'green');
  pointsGroup.appendChild(start);
  
  const end = document.createElementNS(svgNS, 'rect');
  end.setAttribute('x', endX);
  end.setAttribute('y', endY);
  end.setAttribute('width', 1);
  end.setAttribute('height', 1);
  end.setAttribute('fill', 'red');
  pointsGroup.appendChild(end);
  
  // Add points to SVG
  svg.appendChild(pointsGroup);
  
  await updateStatus(`Maze generated in ${((performance.now() - renderStartTime) / 1000).toFixed(1)}s`);
  
  // Convert maze to 2D array for compatibility with other functions
  const maze2D = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      row.push(getCell(x, y));
    }
    maze2D.push(row);
  }
  
  return { 
    maze: maze2D, 
    cellSize: 1,
    startX,
    startY,
    endX,
    endY
  };
}

// Optimized wall detection for Uint8Array mazes
async function getOptimizedWallsUint8(maze, rows, cols) {
  const visited = new Uint8Array(maze.length);
  const walls = [];
  
  // Helper function to check if a cell is a wall
  const isWall = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows || maze[y * cols + x] === 0;
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      
      // Skip if not a wall or already visited
      if (maze[idx] !== 0 || visited[idx]) continue;
      
      // Find the maximum horizontal span
      let width = 1;
      while (x + width < cols && 
             maze[y * cols + x + width] === 0 && 
             !visited[y * cols + x + width]) {
        width++;
      }
      
      // Find the maximum vertical span
      let height = 1;
      let canExtend = true;
      
      while (canExtend && y + height < rows) {
        for (let wx = x; wx < x + width; wx++) {
          const checkIdx = (y + height) * cols + wx;
          if (maze[checkIdx] !== 0 || visited[checkIdx]) {
            canExtend = false;
            break;
          }
        }
        if (canExtend) height++;
      }
      
      // Mark these cells as visited
      for (let wy = y; wy < y + height; wy++) {
        for (let wx = x; wx < x + width; wx++) {
          visited[wy * cols + wx] = 1;
        }
      }
      
      // Add the wall rectangle
      walls.push({ x, y, width, height });
    }
  }
  
  return walls;
}

document.getElementById("generateAndDownloadButton").addEventListener("click", async () => {
  const button = document.getElementById("generateAndDownloadButton");
  const originalText = button.textContent;
  
  try {
    button.disabled = true;
    button.textContent = "Generating...";
    
    const seed = document.getElementById("seedInput").value ||
                Math.floor(Date.now() / 1000).toString();
    const rows = parseInt(document.getElementById("rowsInput").value);
    const cols = parseInt(document.getElementById("colsInput").value);
    
    // Warn for very large mazes
    if (rows * cols > 1000000) { // 1000x1000
      if (!confirm(`Generating a ${rows}x${cols} maze (${(rows * cols).toLocaleString()} cells) may take a while and use significant system resources. Continue?`)) {
        await updateStatus("Operation cancelled");
        return;
      }
    }
    
    await updateStatus("Generating maze data...");
    const mazeData = await generateMazeData(seed, rows, cols);
    
    const optimize = isWallOptimizationEnabled();
    await updateStatus(optimize ? "Optimizing walls..." : "Generating maze...");
    const svgString = await generateSVGString(mazeData, optimize);
    
    await updateStatus("Creating download...");
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    // Create and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `maze_${rows}x${cols}_${seed}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    await updateStatus("Download complete!");
    setTimeout(() => updateStatus("Idle."), 2000);
  } catch (error) {
    console.error("Error generating maze:", error);
    updateStatus("Error: Maze generation failed - " + error.message);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
});