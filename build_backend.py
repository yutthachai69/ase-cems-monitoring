#!/usr/bin/env python3
"""
Build script for ASE CEMS Backend
This script builds the backend with all necessary dependencies and files
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def run_command(command, cwd=None):
    """Run a command and return the result"""
    print(f"Running: {command}")
    if cwd:
        print(f"Working directory: {cwd}")
    
    result = subprocess.run(
        command,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True
    )
    
    if result.stdout:
        print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    
    if result.returncode != 0:
        print(f"Command failed with return code: {result.returncode}")
        return False
    
    return True

def main():
    # Get the project root directory
    project_root = Path(__file__).parent
    backend_dir = project_root / "cems-backend"
    
    print("=== ASE CEMS Backend Build Script ===")
    print(f"Project root: {project_root}")
    print(f"Backend directory: {backend_dir}")
    
    # Check if we're in the right directory
    if not backend_dir.exists():
        print("Error: cems-backend directory not found!")
        return False
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    # Clean previous builds
    print("\n=== Cleaning previous builds ===")
    if (backend_dir / "dist").exists():
        shutil.rmtree(backend_dir / "dist")
    if (backend_dir / "build").exists():
        shutil.rmtree(backend_dir / "build")
    
    # Install requirements if needed
    print("\n=== Installing requirements ===")
    if not run_command("pip install -r requirements.txt"):
        print("Failed to install requirements")
        return False
    
    # Build the backend executable
    print("\n=== Building backend executable ===")
    if not run_command("pyinstaller backend.spec"):
        print("Failed to build backend")
        return False
    
    # Verify the build
    print("\n=== Verifying build ===")
    backend_exe = backend_dir / "dist" / "backend.exe"
    if not backend_exe.exists():
        print("Error: backend.exe not found after build!")
        return False
    
    print(f"Backend executable created: {backend_exe}")
    print(f"File size: {backend_exe.stat().st_size / (1024*1024):.2f} MB")
    
    # Copy additional files to dist directory
    print("\n=== Copying additional files ===")
    files_to_copy = [
        "database_sqlite.py",
        "database_postgres.py", 
        "config.json",
        "mapping.json",
        "blowback_settings.json",
        "cems_data.db",
        "CEMS_DataLog.csv",
        "CEMS_ErrorLog.csv"
    ]
    
    for file_name in files_to_copy:
        src_file = backend_dir / file_name
        dst_file = backend_dir / "dist" / file_name
        
        if src_file.exists():
            shutil.copy2(src_file, dst_file)
            print(f"Copied: {file_name}")
        else:
            print(f"Warning: {file_name} not found")
    
    print("\n=== Backend build completed successfully! ===")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)








