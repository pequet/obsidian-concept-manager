#!/bin/bash

# Standard Error Handling
set -e
set -u
set -o pipefail

# --- Utility Scripts ---
# Source utility functions
# shellcheck source=scripts/utils/logging_utils.sh
source "$(dirname "$0")/utils/logging_utils.sh"
# shellcheck source=scripts/utils/messaging_utils.sh
source "$(dirname "$0")/utils/messaging_utils.sh"

# This script is designed to be a simple, illustrative example of a script
# that can be used as a starting point for a more complex script.
#
# Its primary goal is to provide a clean, well-documented, and easily
# understandable script that can be modified and extended to meet the
# specific needs of any project.

# █ █ █  Concept Manager
#  █ █   Version: 1.1.0
#  █ █   Author: Benjamin Pequet
# █ █ █  GitHub: https://github.com/pequet/obsidian-concept-manager
#
# Purpose:
#   This script serves as a boilerplate example for the main executable
#   in a project. Its primary goal is to demonstrate best practices for 
#   script structure, including argument parsing, usage display, and 
#   section organization.
#
#   Functionally, it can:
#   1. Display the current time in one or more specified timezones.
#   2. Ask a question to an AI model using vibe-tools.
#
# Usage:
#   ./scripts/run_main_script.sh [options] [TIMEZONE_1] [TIMEZONE_2] ...
#   Example (time): ./scripts/run_main_script.sh "America/New_York" "Europe/London"
#   Example (AI query): ./scripts/run_main_script.sh -q "What is the capital of France?"
#
# Options:
#   -q, --query      Ask a question to the AI.
#   -h, --help       Show this help message and exit.
#
# Dependencies:
#   - A system with a working `date` command and timezone data.
#   - `vibe-tools` installed globally for the AI query functionality.
#
# Changelog:
#   1.1.0 - 2025-06-20 - Added AI query functionality and multiple timezone support.
#   1.0.0 - 2025-06-19 - Initial release.
#
# Support the Project:
#   - Buy Me a Coffee: https://buymeacoffee.com/pequet
#   - GitHub Sponsors: https://github.com/sponsors/pequet

# --- Configuration ---
# Set default timezone if not provided
DEFAULT_TIMEZONE="UTC"

# --- Logging Configuration ---
# The script name can be used to generate a log file name
SCRIPT_NAME=$(basename "$0" .sh)
LOG_FILE_PATH="scripts/logs/${SCRIPT_NAME}.log"

# --- Helper Functions ---
show_help() {
    echo "Usage: $0 [options] [TIMEZONE...]"
    echo
    echo "Options:"
    echo "  -q, --query QUERY       Ask a question to the AI via vibe-tools."
    echo "  -h, --help              Show this help message and exit."
    echo
    echo "Arguments:"
    echo "  TIMEZONE                One or more timezones to get the current time for."
    echo "                          (e.g., 'America/New_York', 'Europe/London')"
    echo "                          Defaults to UTC if no timezones are provided."
    echo
    echo "Examples:"
    echo "  $0"
    echo "  $0 America/New_York Europe/London"
    echo "  $0 -q 'What are the benefits of using a shell script boilerplate?'"
}

# --- Main Logic ---
main() {
    print_header "Script Execution"
    ensure_log_directory

    local query=""
    local timezones=()

    # Parse command-line arguments
    while [[ "$#" -gt 0 ]]; do
        case $1 in
            -q|--query)
                if [[ -n "$2" ]]; then
                    query="$2"
                    shift
                else
                    print_error "--query requires a non-empty argument."
                    exit 1
                fi
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -*)
                print_error "Unknown parameter passed: $1"
                show_help
                exit 1
                ;;
            *)
                timezones+=("$1")
                ;;
        esac
        shift
    done

    local action_taken=false
    if [[ -n "$query" ]]; then
        print_step "Asking AI: $query"
        if ! command -v vibe-tools &> /dev/null; then
            print_error "vibe-tools is not installed. Please run 'npm install -g vibe-tools'."
            exit 1
        fi
        vibe-tools ask "$query"
        action_taken=true
    fi

    if [[ ${#timezones[@]} -eq 0 ]] && [[ -z "$query" ]]; then
        timezones=("$DEFAULT_TIMEZONE")
    fi

    if [[ ${#timezones[@]} -gt 0 ]]; then
        print_step "Fetching current time for timezone(s): ${timezones[*]}"
        for tz in "${timezones[@]}"; do
            if ! time_output=$(TZ="$tz" date); then
                print_error "Failed to get the time for timezone '$tz'. Please ensure you are using a valid TZ database name."
            else
                print_info "The current time in $tz is: $time_output"
            fi
        done
        action_taken=true
    fi

    if [[ "$action_taken" = true ]]; then
        print_separator
        print_completed "Script logic finished."
    fi
    
    }

# --- Script Execution ---
main "$@" 