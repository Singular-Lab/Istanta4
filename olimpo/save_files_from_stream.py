import requests
import os

def save_files_from_stream(url, output_dir, ids):
    response = requests.put(url, json={"ids": ids}, stream=True)
    response.raise_for_status()  # Verifica se la richiesta ha avuto successo

    file_data = b""
    separator = b"\n--file-separator--\n"
    name_separator_start = b"\n--file-name--"
    name_separator_end = b"--file-name--\n"

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    while True:
        chunk = response.raw.read(8192)
        if not chunk:
            break
        file_data += chunk

        while separator in file_data:
            file_content, file_data = file_data.split(separator, 1)
            if name_separator_start in file_content and name_separator_end in file_content:
                name_start = file_content.index(name_separator_start) + len(name_separator_start)
                name_end = file_content.index(name_separator_end)
                file_name = file_content[name_start:name_end].decode('utf-8')
                file_content = file_content[name_end + len(name_separator_end):]
                file_path = os.path.join(output_dir, file_name)
                with open(file_path, "wb") as file:
                    file.write(file_content)
                print(f"Saved {file_path}")

    # Salva l'ultimo file se presente
    if file_data:
        if name_separator_start in file_data and name_separator_end in file_data:
            name_start = file_data.index(name_separator_start) + len(name_separator_start)
            name_end = file_data.index(name_separator_end)
            file_name = file_data[name_start:name_end].decode('utf-8')
            file_content = file_data[name_end + len(name_separator_end):]
            file_path = os.path.join(output_dir, file_name)
            with open(file_path, "wb") as file:
                file.write(file_content)
            print(f"Saved {file_path}")

if __name__ == "__main__":
    url = "http://85.215.121.166/olimpo/getFotoStreamFromIds"
    cwd = os.getcwd()  # Ottieni la directory di lavoro corrente
    output_dir = os.path.join(cwd, "output")  # Costruisci il percorso relativo
    ids = ["3236d1a4-abac-413d-be13-35a8a4a44120", "ef838173-2615-4e6f-90d9-84aec1afd139", "f337cc09-5fcd-4f0c-8306-534aa6c38f0c"]  # Sostituisci con gli ID effettivi

    save_files_from_stream(url, output_dir, ids)