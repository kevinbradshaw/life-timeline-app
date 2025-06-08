import React, { useState, useEffect, useRef } from "react";

function MainComponent() {
  const [currentPage, setCurrentPage] = useState("timeline");
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    id: null,
    category: "Residence",
    title: "",
    start: "",
    end: "",
    notes: "",
  });
  const [queryDate, setQueryDate] = useState("");
  const [results, setResults] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const timelineRef = useRef(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 400,
  });
  
  // Import page state
  const [importError, setImportError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const categories = ["Residence", "Job", "Relationship", "Vehicle"];
  const categoryColors = {
    Residence: "#4f46e5",
    Job: "#10b981",
    Relationship: "#ef4444",
    Vehicle: "#f59e0b",
  };

  // Load events from memory on component mount
  useEffect(() => {
    const savedEvents = window.lifeTimelineEvents || [];
    if (savedEvents.length > 0) {
      setEvents(savedEvents);
    } else {
      // Initialize with sample data if no saved events
      const sampleEvents = [
        {
          id: "1",
          category: "Residence",
          title: "Moved to New York",
          start: "2020-01-15",
          end: "2022-06-30",
          notes: "First apartment in the city"
        },
        {
          id: "2", 
          category: "Job",
          title: "Software Developer at TechCorp",
          start: "2020-03-01",
          end: "",
          notes: "Full-stack development role"
        }
      ];
      setEvents(sampleEvents);
      window.lifeTimelineEvents = sampleEvents;
    }
  }, []);

  // Save events to memory whenever events change
  useEffect(() => {
    if (events.length > 0) {
      window.lifeTimelineEvents = events;
    }
  }, [events]);

  useEffect(() => {
    if (!timelineRef.current) return;
    const handleResize = (entries) => {
      for (let entry of entries) {
        if (entry.contentRect) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(timelineRef.current);
    setContainerSize({
      width: timelineRef.current.clientWidth,
      height: timelineRef.current.clientHeight,
    });
    return () => resizeObserver.disconnect();
  }, [currentPage]);

  function safeParse(str) {
    try {
      return new Date(str);
    } catch {
      return new Date();
    }
  }

  function addOrUpdateEvent() {
    if (!form.title || !form.start) {
      alert("Please provide at least a title and a start date.");
      return;
    }
    if (form.id) {
      setEvents(events.map((e) => (e.id === form.id ? form : e)));
    } else {
      const newEvent = { ...form, id: Date.now().toString() };
      setEvents([...events, newEvent]);
    }
    setForm({
      id: null,
      category: "Residence",
      title: "",
      start: "",
      end: "",
      notes: "",
    });
  }

  function editEvent(id) {
    const event = events.find((e) => e.id === id);
    if (event) setForm(event);
  }

  function deleteEvent(id) {
    console.log("Delete clicked for ID:", id);
    setDeleteConfirm(id);
  }

  function confirmDelete() {
    if (deleteConfirm) {
      console.log("Confirming deletion for ID:", deleteConfirm);
      setEvents(prevEvents => {
        const filtered = prevEvents.filter((e) => e.id !== deleteConfirm);
        console.log("Events after deletion:", filtered);
        return filtered;
      });
      setDeleteConfirm(null);
    }
  }

  function cancelDelete() {
    setDeleteConfirm(null);
  }

  function queryByDate() {
    if (!queryDate) return;
    const query = safeParse(queryDate);
    const filtered = categories.map((cat) => {
      const matches = events.filter((e) => {
        const start = safeParse(e.start);
        const end = e.end ? safeParse(e.end) : new Date();
        return e.category === cat && start <= query && end >= query;
      });
      return { category: cat, matches };
    });
    setResults(filtered);
  }

  // Data export/import functions
  function exportData() {
    const dataStr = JSON.stringify(events, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'life-timeline-backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  function handleJSONImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const importedEvents = JSON.parse(event.target.result);
        if (Array.isArray(importedEvents)) {
          setEvents(importedEvents);
          alert(`Successfully imported ${importedEvents.length} events`);
        } else {
          alert('Invalid JSON format');
        }
      } catch (error) {
        alert('Error reading JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      setEvents([]);
      window.lifeTimelineEvents = [];
    }
  }

  // CSV Import Functions
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  async function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImportError(null);
      setUploading(true);
      
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const newEvents = lines
        .slice(1) // Skip header
        .map((line, index) => {
          const fields = parseCSVLine(line);
          const [category, title, start, end, notes] = fields.map(field => 
            field.replace(/^"(.*)"$/, '$1') // Remove surrounding quotes
          );

          if (!title || !start) {
            return null; // Skip empty rows
          }

          if (!categories.includes(category)) {
            throw new Error(
              `Invalid category "${category}" on line ${index + 2}. Must be one of: ${categories.join(", ")}`
            );
          }

          const startDate = new Date(start);
          if (isNaN(startDate.getTime())) {
            throw new Error(`Invalid start date "${start}" on line ${index + 2}`);
          }
          
          if (end) {
            const endDate = new Date(end);
            if (isNaN(endDate.getTime())) {
              throw new Error(`Invalid end date "${end}" on line ${index + 2}`);
            }
          }

          return {
            id: Date.now().toString() + '-' + index,
            category,
            title,
            start,
            end: end || "",
            notes: notes || "",
          };
        })
        .filter(event => event !== null);

      // Merge with existing events
      const mergedEvents = [...events];
      newEvents.forEach((newEvent) => {
        if (!mergedEvents.some((e) => 
          e.title === newEvent.title && 
          e.start === newEvent.start && 
          e.category === newEvent.category
        )) {
          mergedEvents.push(newEvent);
        }
      });

      setEvents(mergedEvents);
      alert(`Successfully imported ${newEvents.length} events`);
      e.target.value = "";
    } catch (error) {
      console.error("Import error:", error);
      setImportError(error.message || "Failed to import CSV file. Please check the file format.");
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const header = "Category,Title,Start Date,End Date,Notes";
    const examples = [
      'Residence,"My First Apartment",2023-01-01,2024-01-01,"Great location near downtown"',
      'Job,"Software Developer",2023-06-01,,"Working at a tech startup"',
      'Vehicle,"Honda Civic",2022-03-15,2024-03-15,"Reliable car for commuting"'
    ];
    const csvContent = `${header}\n${examples.join('\n')}`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "life_events_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Timeline calculations
  const filteredEvents = categoryFilter === "All" ? events : events.filter((e) => e.category === categoryFilter);
  const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.start) - new Date(b.start));

  let minDate = null;
  let maxDate = null;
  events.forEach((e) => {
    const start = safeParse(e.start);
    if (!minDate || start < minDate) minDate = start;
    if (e.end) {
      const end = safeParse(e.end);
      if (!maxDate || end > maxDate) maxDate = end;
    } else {
      if (!maxDate || start > maxDate) maxDate = start;
    }
  });
  if (!minDate) minDate = new Date();
  if (!maxDate) maxDate = new Date(minDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  minDate = new Date(minDate.setDate(minDate.getDate() - 30));
  maxDate = new Date(maxDate.setDate(maxDate.getDate() + 30));
  const totalDays = Math.floor((maxDate - minDate) / (1000 * 60 * 60 * 24));
  const rowHeight = 40;

  function xPos(dateStr) {
    const date = safeParse(dateStr);
    const diff = Math.floor((date - minDate) / (1000 * 60 * 60 * 24));
    return (diff / totalDays) * containerSize.width;
  }

  function generateTicks() {
    const ticks = [];
    const tickCount = 10;
    for (let i = 0; i <= tickCount; i++) {
      const tickDate = new Date(
        minDate.getTime() + ((totalDays * i) / tickCount) * 24 * 60 * 60 * 1000
      );
      ticks.push(tickDate);
    }
    return ticks;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this event?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Life Timeline</h1>
              </div>
              <div className="ml-6 flex space-x-8">
                <button
                  onClick={() => setCurrentPage("timeline")}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentPage === "timeline"
                      ? "border-indigo-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setCurrentPage("import")}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentPage === "import"
                      ? "border-indigo-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Import/Export
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto py-6">
        {currentPage === "timeline" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
            {/* Add Event Form */}
            <div className="bg-white rounded-lg shadow p-4 flex flex-col">
              <h2 className="text-xl font-bold mb-2">
                {form.id ? "Edit Event" : "Add Life Event"}
              </h2>
              <select
                className="mb-2 p-2 w-full border rounded"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                placeholder="Title"
                className="mb-2 p-2 w-full border rounded"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <label className="text-sm text-gray-600 mb-1">Start Date:</label>
              <input
                type="date"
                className="mb-2 p-2 w-full border rounded"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
              <label className="text-sm text-gray-600 mb-1">End Date (optional):</label>
              <input
                type="date"
                className="mb-2 p-2 w-full border rounded"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
              <textarea
                placeholder="Notes"
                className="mb-2 p-2 w-full h-20 border rounded"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className="flex gap-2">
                <button
                  onClick={addOrUpdateEvent}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  {form.id ? "Update Event" : "Add Event"}
                </button>
                <button
                  onClick={() =>
                    setForm({
                      id: null,
                      category: "Residence",
                      title: "",
                      start: "",
                      end: "",
                      notes: "",
                    })
                  }
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Clear
                </button>
              </div>
              <div className="flex-grow overflow-y-auto border-t pt-2 mt-4">
                <h3 className="font-semibold mb-2">Your Events</h3>
                {events.length === 0 && <p className="text-gray-500">No events yet.</p>}
                <ul className="space-y-1 max-h-60 overflow-y-auto">
                  {events.map((e) => (
                    <li
                      key={e.id}
                      className="flex justify-between items-center border rounded p-2 bg-gray-50"
                      style={{
                        borderLeft: `6px solid ${categoryColors[e.category]}`,
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{e.title}</span>
                        <small className="text-gray-600">
                          {e.category} | {e.start} - {e.end || "Present"}
                        </small>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => editEvent(e.id)}
                          className="text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteEvent(e.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Timeline Visualization */}
            <div className="bg-white rounded-lg shadow p-4 md:col-span-2">
              <h2 className="text-xl font-bold mb-2">Timeline</h2>
              <select
                className="mb-2 p-2 w-full border rounded"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="flex gap-4 text-sm mt-2 mb-2">
                {categories.map((cat) => (
                  <div key={cat} className="flex items-center gap-1">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        backgroundColor: categoryColors[cat],
                        borderRadius: 2,
                      }}
                    />
                    {cat}
                  </div>
                ))}
              </div>
              <div
                ref={timelineRef}
                style={{
                  resize: "both",
                  overflow: "auto",
                  border: "1px solid #ccc",
                  width: "100%",
                  height: 400,
                  backgroundColor: "#fff",
                  paddingTop: 20,
                }}
              >
                <svg
                  width={containerSize.width}
                  height={containerSize.height}
                  style={{ overflow: "visible" }}
                >
                  <line
                    x1={0}
                    y1={containerSize.height - 30}
                    x2={containerSize.width}
                    y2={containerSize.height - 30}
                    stroke="#333"
                    strokeWidth={2}
                  />
                  {generateTicks().map((tickDate, idx) => {
                    const x = xPos(tickDate.toISOString());
                    return (
                      <g
                        key={idx}
                        transform={`translate(${x}, ${containerSize.height - 30})`}
                      >
                        <line y2={6} stroke="#333" />
                        <text
                          y={20}
                          textAnchor="middle"
                          fontSize={12}
                          fill="#333"
                          style={{ userSelect: "none" }}
                        >
                          {tickDate.toLocaleDateString(undefined, {
                            month: "short",
                            year: "numeric",
                          })}
                        </text>
                      </g>
                    );
                  })}
                  {sortedEvents.map((_, i) => (
                    <line
                      key={i}
                      x1={0}
                      y1={i * rowHeight + 10}
                      x2={containerSize.width}
                      y2={i * rowHeight + 10}
                      stroke="#eee"
                    />
                  ))}
                  {sortedEvents.map((e, i) => {
                    const startX = xPos(e.start);
                    const endX = e.end ? xPos(e.end) : xPos(new Date().toISOString());
                    const width = Math.max(endX - startX, 40);
                    return (
                      <rect
                        key={e.id}
                        x={startX}
                        y={i * rowHeight + 5}
                        width={width}
                        height={30}
                        fill={categoryColors[e.category]}
                        rx={4}
                        ry={4}
                      >
                        <title>
                          {e.category}: {e.title} ({e.start} - {e.end || "Present"})
                        </title>
                      </rect>
                    );
                  })}
                  {sortedEvents.map((e, i) => {
                    const startX = xPos(e.start);
                    const endX = e.end ? xPos(e.end) : xPos(new Date().toISOString());
                    const width = Math.max(endX - startX, 40);
                    const labelText = width < 60 ? "" : e.title;
                    return (
                      <text
                        key={e.id + "-text"}
                        x={startX + 5}
                        y={i * rowHeight + 27}
                        fontSize={12}
                        fill="#fff"
                        style={{ pointerEvents: "none" }}
                      >
                        {labelText}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Query Section */}
            <div className="bg-white rounded-lg shadow p-4 md:col-start-1">
              <h2 className="text-xl font-bold mb-2">Query by Date</h2>
              <input
                type="date"
                className="mb-2 p-2 w-full border rounded"
                value={queryDate}
                onChange={(e) => setQueryDate(e.target.value)}
              />
              <button
                className="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
                onClick={queryByDate}
              >
                Find Life Snapshot
              </button>
              {results.length > 0 && (
                <div>
                  {results.map((r, i) => (
                    <div key={i} className="mb-4">
                      <strong>{r.category}:</strong>
                      {r.matches.length > 0 ? (
                        <ul className="list-disc list-inside ml-2">
                          {r.matches.map((item, j) => (
                            <li key={j} className="text-sm">
                              {item.title}
                              {item.notes ? <em> – {item.notes}</em> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-sm ml-2">No data</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Import/Export Page */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Import Life Events</h2>
              
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold mb-3 text-blue-900">CSV Format Instructions</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Your CSV should have these columns: Category, Title, Start Date, End Date, Notes
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Category:</strong> Must be one of: {categories.join(", ")}</li>
                  <li>• <strong>Title:</strong> Name of the event (required)</li>
                  <li>• <strong>Start Date:</strong> YYYY-MM-DD format (required)</li>
                  <li>• <strong>End Date:</strong> YYYY-MM-DD format (optional)</li>
                  <li>• <strong>Notes:</strong> Additional details (optional)</li>
                </ul>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Upload CSV File</h3>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileImport}
                  className="w-full mb-3 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  disabled={uploading}
                />
                {uploading && (
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Processing file...
                  </div>
                )}
                {importError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {importError}
                  </div>
                )}
                <button
                  onClick={downloadTemplate}
                  className="mt-3 text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Download CSV Template
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Import JSON Backup</h3>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJSONImport}
                  className="w-full file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Import a previously exported JSON backup file
                </p>
              </div>
              
              <div className="text-sm text-gray-600">
                <p><strong>Total Events:</strong> {events.length}</p>
                <p className="text-xs text-green-600 mt-1">
                  ✓ Data automatically saved in browser memory
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4">Export & Data Management</h3>
              
              <div className="space-y-4 mb-6">
                <button
                  onClick={exportData}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export JSON Backup
                </button>
                
                <button
                  onClick={clearAllData}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear All Data
                </button>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Current Events</h4>
                {events.length === 0 ? (
                  <p className="text-gray-500">No events imported yet.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {events.map((e) => (
                      <div
                        key={e.id}
                        className="border rounded p-3 bg-gray-50"
                        style={{
                          borderLeft: `4px solid ${categoryColors[e.category]}`,
                        }}
                      >
                        <div className="font-medium">{e.title}</div>
                        <div className="text-sm text-gray-600">
                          <span className="inline-block px-2 py-1 bg-gray-200 rounded text-xs mr-2">
                            {e.category}
                          </span>
                          {e.start} - {e.end || "Present"}
                        </div>
                        {e.notes && (
                          <div className="text-sm text-gray-700 mt-1 italic">{e.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainComponent;
