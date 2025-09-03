#!/usr/bin/env python3
"""
Complete build script for ASE CEMS Application
This script builds both backend and frontend with all necessary files
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
    frontend_dir = project_root / "cems-frontend-new"
    
    print("=== ASE CEMS Complete Build Script ===")
    print(f"Project root: {project_root}")
    print(f"Backend directory: {backend_dir}")
    print(f"Frontend directory: {frontend_dir}")
    
    # Check if directories exist
    if not backend_dir.exists():
        print("Error: cems-backend directory not found!")
        return False
    
    if not frontend_dir.exists():
        print("Error: cems-frontend-new directory not found!")
        return False
    
    # Step 1: Build Backend
    print("\n" + "="*50)
    print("STEP 1: BUILDING BACKEND")
    print("="*50)
    
    os.chdir(backend_dir)
    
    # Clean previous builds
    print("\n--- Cleaning previous backend builds ---")
    if (backend_dir / "dist").exists():
        shutil.rmtree(backend_dir / "dist")
    if (backend_dir / "build").exists():
        shutil.rmtree(backend_dir / "build")
    
    # Install requirements
    print("\n--- Installing backend requirements ---")
    if not run_command("pip install -r requirements.txt"):
        print("Failed to install backend requirements")
        return False
    
    # Build backend executable
    print("\n--- Building backend executable ---")
    if not run_command("pyinstaller backend.spec"):
        print("Failed to build backend")
        return False
    
    # Copy additional files to dist directory
    print("\n--- Copying backend files ---")
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
    
    # Step 2: Build Frontend
    print("\n" + "="*50)
    print("STEP 2: BUILDING FRONTEND")
    print("="*50)
    
    os.chdir(frontend_dir)
    
    # Install frontend dependencies
    print("\n--- Installing frontend dependencies ---")
    if not run_command("npm install"):
        print("Failed to install frontend dependencies")
        return False
    
    # Build frontend
    print("\n--- Building frontend ---")
    if not run_command("npm run build"):
        print("Failed to build frontend")
        return False
    
    # Step 3: Build Electron App
    print("\n" + "="*50)
    print("STEP 3: BUILDING ELECTRON APP")
    print("="*50)
    
    # Build electron app
    print("\n--- Building electron app ---")
    if not run_command("npm run dist"):
        print("Failed to build electron app")
        return False
    
    # Verify final build
    print("\n" + "="*50)
    print("STEP 4: VERIFYING BUILD")
    print("="*50)
    
    build_dir = project_root / "build2"
    if build_dir.exists():
        print(f"Build completed successfully!")
        print(f"Build directory: {build_dir}")
        
        # List build contents
        print("\n--- Build contents ---")
        for item in build_dir.iterdir():
            if item.is_file():
                size_mb = item.stat().st_size / (1024*1024)
                print(f"File: {item.name} ({size_mb:.2f} MB)")
            else:
                print(f"Directory: {item.name}")
    else:
        print("Error: Build directory not found!")
        return False
    
    print("\n" + "="*50)
    print("BUILD COMPLETED SUCCESSFULLY!")
    print("="*50)
    print("You can now run the application from the build2 directory.")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

























