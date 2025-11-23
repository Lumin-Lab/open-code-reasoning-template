import { DebateTopic, Speaker } from '../types';

declare global {
  interface Window {
    initSqlJs: (config: { locateFile: (file: string) => string }) => Promise<any>;
  }
}

let dbInstance: any = null;

const SEED_DATA = [
  {
    title: "Bubble Sort: Efficiency vs Simplicity",
    description: "Discussing whether Bubble Sort has any practical use cases in modern development given its O(n²) complexity.",
    code: `def bubble_sort(arr):
    n = len(arr)
    while True:
        swapped = False
        for i in range(n - 1):
            if arr[i] > arr[i + 1]:
                # Swap elements
                arr[i], arr[i + 1] = arr[i + 1], arr[i]
                swapped = True
        if not swapped:
            break
    return arr`,
    script: JSON.stringify([
      { id: '1', speaker: Speaker.Tutor, text: "Let's examine Bubble Sort in Python. It's often the first algorithm taught, but do you see why it's rarely used in production?" },
      { id: '2', speaker: Speaker.Student, text: "I see the nested structure with the while and for loops... that looks like O(n²) time complexity. Is it ever faster than Merge Sort?" },
      { id: '3', speaker: Speaker.Tutor, text: "Almost never for large datasets. However, it has one redeeming quality: it detects if a list is *already* sorted efficiently, in O(n) time." },
      { id: '4', speaker: Speaker.Student, text: "Wait, look at line 4 `swapped = False`. If the list is sorted, the loop runs once, `swapped` stays False, and it breaks? That's actually clever." },
      { id: '5', speaker: Speaker.Tutor, text: "Precisely! It's also stable and uses O(1) extra memory. But for unsorted large lists, please use the built-in `sort()` or `sorted()`." }
    ])
  },
  {
    title: "Quick Sort: The Pivot Problem",
    description: "Analyzing how the choice of pivot affects the performance of Quick Sort, specifically focusing on worst-case scenarios.",
    code: `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    
    # Naive pivot selection
    pivot = arr[-1]
    left = []
    right = []
    
    for x in arr[:-1]:
        if x < pivot:
            left.append(x)
        else:
            right.append(x)
            
    return quick_sort(left) + [pivot] + quick_sort(right)`,
    script: JSON.stringify([
      { id: '1', speaker: Speaker.Tutor, text: "This Python implementation of Quick Sort uses the last element as a pivot. Can you spot the danger in this approach?" },
      { id: '2', speaker: Speaker.Student, text: "If I pass in a list that's already sorted... like `[1, 2, 3, 4]`, the pivot will always be the max value." },
      { id: '3', speaker: Speaker.Tutor, text: "Correct. And if the pivot is always the maximum (or minimum), the partition becomes unbalanced. One side has n-1 elements, the other has 0." },
      { id: '4', speaker: Speaker.Student, text: "So it degrades to O(n²) just like Bubble Sort? That sounds terrible for a 'Quick' sort." },
      { id: '5', speaker: Speaker.Tutor, text: "It is. That's why robust implementations use 'median-of-three' or random pivots to ensure O(n log n) on average." }
    ])
  },
  {
    title: "Merge Sort: The Space Trade-off",
    description: "Debating the memory implications of Merge Sort compared to in-place algorithms.",
    code: `def merge_sort(arr):
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])

    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    
    while i < len(left) and j < len(right):
        if left[i] < right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
            
    result.extend(left[i:])
    result.extend(right[j:])
    return result`,
    script: JSON.stringify([
      { id: '1', speaker: Speaker.Tutor, text: "Merge Sort is reliable. It guarantees O(n log n) time complexity. But look at the `result` list in the merge function." },
      { id: '2', speaker: Speaker.Student, text: "We are creating a new list for every merge step? That seems like a lot of memory allocation." },
      { id: '3', speaker: Speaker.Tutor, text: "It is. Merge Sort requires O(n) auxiliary space. In environments with limited memory, this can be a dealbreaker." },
      { id: '4', speaker: Speaker.Student, text: "So if I'm sorting 1GB of data, I need another 1GB of RAM just to run the sort? That explains why Quick Sort is often preferred for in-memory sorting." },
      { id: '5', speaker: Speaker.Tutor, text: "Exactly. Stability and consistent speed vs. memory efficiency. It's all about trade-offs." }
    ])
  }
];

export const initDB = async () => {
  if (dbInstance) return dbInstance;

  // Wait for window.initSqlJs to be available if script is loading
  if (!window.initSqlJs) {
      console.warn("SQL.js not loaded yet");
      throw new Error("SQL.js library not loaded");
  }

  const SQL = await window.initSqlJs({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
  });

  const db = new SQL.Database();
  
  // Create table
  db.run(`CREATE TABLE debates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    code TEXT,
    script TEXT
  );`);

  // Seed data
  const stmt = db.prepare("INSERT INTO debates (title, description, code, script) VALUES (?, ?, ?, ?)");
  SEED_DATA.forEach(data => {
      stmt.run([data.title, data.description, data.code, data.script]);
  });
  stmt.free();
  
  dbInstance = db;
  return db;
};

export const getDebates = async (): Promise<DebateTopic[]> => {
  const db = await initDB();
  const res = db.exec("SELECT * FROM debates");
  if (res.length === 0) return [];
  
  const values = res[0].values;
  
  return values.map((row: any[]) => {
    return {
      id: row[0],
      title: row[1],
      description: row[2],
      code: row[3],
      script: JSON.parse(row[4] as string)
    };
  });
};