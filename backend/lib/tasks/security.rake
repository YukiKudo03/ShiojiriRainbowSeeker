# frozen_string_literal: true

# =============================================================================
# Security Rake Tasks
# =============================================================================
# These tasks run security scanning tools to identify vulnerabilities in the
# codebase and its dependencies.
#
# Available tasks:
#   rake security:scan      - Run all security scans
#   rake security:brakeman  - Run Brakeman static analysis
#   rake security:audit     - Run bundler-audit dependency scan
#   rake security:update    - Update vulnerability database
#   rake security:report    - Generate comprehensive security report
# =============================================================================

namespace :security do
  desc "Run all security scans (Brakeman + bundler-audit)"
  task scan: :environment do
    puts "\n=========================================="
    puts "Running Full Security Scan"
    puts "=========================================="
    puts "Date: #{Time.current}"
    puts ""

    # Ensure report directory exists
    FileUtils.mkdir_p("tmp/security_reports")

    results = {}

    # Run Brakeman
    results[:brakeman] = run_brakeman_scan
    puts ""

    # Run bundler-audit
    results[:audit] = run_bundler_audit_scan
    puts ""

    # Print summary
    print_scan_summary(results)

    # Exit with failure if any scan failed
    exit(1) if results.values.any? { |r| r[:status] == :failure }
  end

  desc "Run Brakeman static analysis for security vulnerabilities"
  task brakeman: :environment do
    puts "\n=========================================="
    puts "Running Brakeman Security Scan"
    puts "=========================================="
    puts ""

    FileUtils.mkdir_p("tmp/security_reports")
    result = run_brakeman_scan

    exit(1) if result[:status] == :failure
  end

  desc "Run bundler-audit to check for vulnerable dependencies"
  task audit: :environment do
    puts "\n=========================================="
    puts "Running Bundler-Audit Dependency Scan"
    puts "=========================================="
    puts ""

    FileUtils.mkdir_p("tmp/security_reports")
    result = run_bundler_audit_scan

    exit(1) if result[:status] == :failure
  end

  desc "Update bundler-audit vulnerability database"
  task update: :environment do
    puts "\n=========================================="
    puts "Updating Vulnerability Database"
    puts "=========================================="
    puts ""

    if system("bundle exec bundler-audit update")
      puts "\n[SUCCESS] Vulnerability database updated"
    else
      puts "\n[ERROR] Failed to update vulnerability database"
      exit(1)
    end
  end

  desc "Generate comprehensive security report"
  task report: :environment do
    puts "\n=========================================="
    puts "Generating Security Report"
    puts "=========================================="
    puts ""

    FileUtils.mkdir_p("tmp/security_reports")

    # Generate Brakeman JSON report
    system("bundle exec brakeman -o tmp/security_reports/brakeman_report.json -q --no-pager")

    # Generate bundler-audit report
    audit_output = `bundle exec bundler-audit check 2>&1`
    File.write("tmp/security_reports/bundler_audit_report.txt", audit_output)

    # Generate summary report
    generate_summary_report

    puts "\nReports generated in tmp/security_reports/"
    puts "  - brakeman_report.json"
    puts "  - brakeman_report.html"
    puts "  - bundler_audit_report.txt"
    puts "  - security_summary.md"
  end

  desc "Quick security check (CI mode - minimal output)"
  task ci: :environment do
    FileUtils.mkdir_p("tmp/security_reports")

    brakeman_success = system("bundle exec brakeman -q -w2 -o tmp/security_reports/brakeman_report.json --no-pager")
    audit_success = system("bundle exec bundler-audit check --quiet")

    if brakeman_success && audit_success
      puts "[PASS] All security checks passed"
    else
      puts "[FAIL] Security vulnerabilities detected"
      exit(1)
    end
  end
end

# Add top-level alias for convenience
desc "Run all security scans (alias for security:scan)"
task security: "security:scan"

# =============================================================================
# Helper Methods
# =============================================================================

def run_brakeman_scan
  puts "Scanning Rails code for security vulnerabilities..."
  puts "This checks for: SQL injection, XSS, CSRF, mass assignment, etc."
  puts ""

  report_file = "tmp/security_reports/brakeman_report"

  success = system(
    "bundle exec brakeman",
    "-o", "#{report_file}.html",
    "-o", "#{report_file}.json",
    "--no-pager"
  )

  if success
    puts "\n[PASS] Brakeman: No vulnerabilities found"
    puts "       Reports: #{report_file}.html, #{report_file}.json"
    { status: :success, message: "No vulnerabilities found" }
  else
    puts "\n[FAIL] Brakeman: Security vulnerabilities detected"
    puts "       Review: #{report_file}.html"
    { status: :failure, message: "Vulnerabilities detected" }
  end
end

def run_bundler_audit_scan
  puts "Checking gem dependencies for known vulnerabilities..."
  puts ""

  # Update database first
  system("bundle exec bundler-audit update", out: File::NULL, err: File::NULL)

  output_file = "tmp/security_reports/bundler_audit_report.txt"
  output = `bundle exec bundler-audit check 2>&1`
  File.write(output_file, output)

  if $?.success?
    puts "\n[PASS] Bundler-Audit: No vulnerable dependencies found"
    { status: :success, message: "No vulnerable dependencies" }
  else
    puts "\n[FAIL] Bundler-Audit: Vulnerable dependencies detected"
    puts "       Report: #{output_file}"
    puts ""
    puts output
    { status: :failure, message: "Vulnerable dependencies detected" }
  end
end

def print_scan_summary(results)
  puts "=========================================="
  puts "Security Scan Summary"
  puts "=========================================="
  puts ""

  results.each do |scan, result|
    status_icon = result[:status] == :success ? "[PASS]" : "[FAIL]"
    puts "#{status_icon} #{scan.to_s.capitalize}: #{result[:message]}"
  end

  puts ""

  if results.values.all? { |r| r[:status] == :success }
    puts "[SUCCESS] All security scans passed"
    puts ""
    puts "Reports saved to: tmp/security_reports/"
  else
    puts "[FAILURE] Security issues were detected"
    puts ""
    puts "Please review the reports in: tmp/security_reports/"
    puts "  - brakeman_report.html (static analysis)"
    puts "  - bundler_audit_report.txt (dependency vulnerabilities)"
  end
end

def generate_summary_report
  report_path = "tmp/security_reports/security_summary.md"

  brakeman_json_path = "tmp/security_reports/brakeman_report.json"
  brakeman_data = if File.exist?(brakeman_json_path)
                    JSON.parse(File.read(brakeman_json_path))
  else
                    {}
  end

  audit_path = "tmp/security_reports/bundler_audit_report.txt"
  audit_content = File.exist?(audit_path) ? File.read(audit_path) : ""

  File.open(report_path, "w") do |f|
    f.puts "# Security Scan Report"
    f.puts ""
    f.puts "Generated: #{Time.current}"
    f.puts ""

    f.puts "## Summary"
    f.puts ""
    f.puts "| Check | Status |"
    f.puts "|-------|--------|"

    brakeman_status = brakeman_data.dig("warnings")&.empty? ? "PASS" : "FAIL"
    f.puts "| Brakeman | #{brakeman_status} |"

    audit_status = audit_content.include?("No vulnerabilities found") ? "PASS" : "FAIL"
    f.puts "| Bundler-Audit | #{audit_status} |"

    f.puts ""

    if brakeman_data["warnings"]&.any?
      f.puts "## Brakeman Warnings"
      f.puts ""
      brakeman_data["warnings"].each do |warning|
        f.puts "### #{warning['warning_type']}"
        f.puts ""
        f.puts "- **File**: #{warning['file']}:#{warning['line']}"
        f.puts "- **Confidence**: #{warning['confidence']}"
        f.puts "- **Message**: #{warning['message']}"
        f.puts ""
      end
    end

    unless audit_content.include?("No vulnerabilities found")
      f.puts "## Bundler-Audit Results"
      f.puts ""
      f.puts "```"
      f.puts audit_content
      f.puts "```"
    end

    f.puts ""
    f.puts "## Security Checks Performed"
    f.puts ""
    f.puts "### Brakeman (Static Analysis)"
    f.puts ""
    f.puts "- SQL Injection"
    f.puts "- Cross-Site Scripting (XSS)"
    f.puts "- Cross-Site Request Forgery (CSRF)"
    f.puts "- Mass Assignment"
    f.puts "- Remote Code Execution"
    f.puts "- Command Injection"
    f.puts "- File Access"
    f.puts "- Session Settings"
    f.puts "- Unsafe Redirect"
    f.puts ""
    f.puts "### Bundler-Audit (Dependency Scan)"
    f.puts ""
    f.puts "- Known CVEs in gem dependencies"
    f.puts "- Insecure gem sources"
    f.puts "- Outdated gems with security patches"
  end

  # Also generate HTML report
  system("bundle exec brakeman -o tmp/security_reports/brakeman_report.html -q --no-pager")
end
