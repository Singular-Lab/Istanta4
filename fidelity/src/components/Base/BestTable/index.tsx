import React, { useState } from "react";
import { motion } from "framer-motion";

// Componente generico
const ExpandableTable = ({ data, headers, renderRowContent } : {data : any, headers : any, renderRowContent : any}) => {
  const [expandedRow, setExpandedRow] = useState(null);

  const handleExpand = (rowId: React.SetStateAction<null>) => {
    setExpandedRow(expandedRow === rowId ? null : rowId);
  };

  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow-lg">
      <table className="min-w-full bg-white rounded-lg">
        <thead>
          <tr>
            {headers.map((header: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined, idx: React.Key | null | undefined) => (
              <th
                key={idx}
                className="py-2 px-4 text-left text-gray-600 font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row: { [x: string]: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; id?: any; }) => (
            <React.Fragment key={row.id}>
              <tr
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handleExpand(row.id)}
              >
                {Object.keys(row).map((key, index) => (
                  <td key={index} className="py-2 px-4">
                    {key === "expand" ? (
                      <button className="mr-2">
                        {expandedRow === row.id ? "▲" : "▼"}
                      </button>
                    ) : (
                      row[key]
                    )}
                  </td>
                ))}
              </tr>

              {/* Contenuto espandibile */}
              {expandedRow === row.id && (
                <motion.tr
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <td colSpan={headers.length} className="py-2 px-4 bg-gray-50">
                    {renderRowContent(row)}
                  </td>
                </motion.tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Funzione per generare contenuto della riga espandibile
const RowContent = (row: { field1: string | number | readonly string[] | undefined; field2: string | number | readonly string[] | undefined; field3: string | number | readonly string[] | undefined; }) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Field 1
        </label>
        <input
          type="text"
          value={row.field1}
          className="mt-1 p-2 border border-gray-300 rounded-md w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Field 2
        </label>
        <select
          className="mt-1 p-2 border border-gray-300 rounded-md w-full"
          defaultValue={row.field2}
        >
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Field 3
        </label>
        <input
          type="text"
          value={row.field3}
          className="mt-1 p-2 border border-gray-300 rounded-md w-full"
        />
      </div>
    </div>
  );
};

export { ExpandableTable, RowContent };
