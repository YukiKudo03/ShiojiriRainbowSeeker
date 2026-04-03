# frozen_string_literal: true

namespace :demo do
  desc "Trigger a Rainbow Moment for demo/presentation purposes"
  task :trigger_moment, [:location_id] => :environment do |_t, args|
    unless Rails.env.development? || Rails.env.staging?
      puts "ERROR: Demo tasks are only available in development/staging"
      exit 1
    end

    location_id = args[:location_id] || "daimon"
    location = RainbowAlertJob::MONITORING_LOCATIONS.find { |l| l[:id] == location_id }

    unless location
      puts "ERROR: Unknown location '#{location_id}'"
      puts "Available locations:"
      RainbowAlertJob::MONITORING_LOCATIONS.each do |loc|
        puts "  #{loc[:id]} — #{loc[:name]} (#{loc[:lat]}, #{loc[:lng]})"
      end
      exit 1
    end

    puts "Triggering Rainbow Moment at #{location[:name]}..."

    moment = RainbowMoment.create_for_alert(
      location: location,
      weather_data: {
        temperature: 18.5,
        humidity: 72,
        cloud_cover: 45,
        sun_altitude: 25.0,
        weather_code: "500",
        weather_description: "light rain",
        visibility: 8000,
        rain_1h: 1.2
      }
    )

    # Broadcast globally
    ActionCable.server.broadcast("rainbow_moments:global", {
      type: "moment_started",
      moment: {
        id: moment.id,
        location_id: moment.location_id,
        location_name: moment.location_name,
        status: moment.status,
        starts_at: moment.starts_at.iso8601,
        ends_at: moment.ends_at.iso8601
      }
    })

    puts ""
    puts "Rainbow Moment created!"
    puts "  ID:        #{moment.id}"
    puts "  Location:  #{moment.location_name} (#{location_id})"
    puts "  Status:    #{moment.status}"
    puts "  Starts at: #{moment.starts_at}"
    puts "  Ends at:   #{moment.ends_at}"
    puts ""
    puts "The moment will auto-close in #{RainbowMoment::DEFAULT_DURATION / 60} minutes."
    puts "Connected mobile clients should see the overlay now."
  end

  desc "List all monitoring locations available for demo"
  task locations: :environment do
    puts "Monitoring Locations:"
    puts ""
    RainbowAlertJob::MONITORING_LOCATIONS.each do |loc|
      active = RainbowMoment.active.for_location(loc[:id]).exists?
      status = active ? " [ACTIVE]" : ""
      puts "  #{loc[:id].ljust(20)} #{loc[:name]}#{status}"
      puts "  #{' ' * 20} lat=#{loc[:lat]}, lng=#{loc[:lng]}"
    end
  end

  desc "Show current Rainbow Moment status"
  task status: :environment do
    active = RainbowMoment.where(status: %w[active closing]).recent
    if active.empty?
      puts "No active Rainbow Moments."
    else
      active.each do |m|
        remaining = [(m.ends_at - Time.current) / 60, 0].max.round(1)
        puts "#{m.location_name} [#{m.status.upcase}]"
        puts "  ID:           #{m.id}"
        puts "  Participants: #{m.active_participants_count}"
        puts "  Photos:       #{m.photos.count}"
        puts "  Remaining:    #{remaining} min"
        puts ""
      end
    end
  end
end
