# frozen_string_literal: true

# Manages Rainbow Moment lifecycle transitions.
#
# Runs every minute to check active/closing moments and transition
# them to the next state when their time window expires.
#
# == Transitions
# - active → closing: when ends_at is reached
# - closing → archived: when ends_at + 5 minutes (grace period)
#
class RainbowMomentLifecycleJob < ApplicationJob
  queue_as :default

  def perform
    # Transition active moments to closing
    RainbowMoment.active.where("ends_at <= ?", Time.current).find_each(&:close!)

    # Transition closing moments to archived
    grace_seconds = RainbowMoment::CLOSING_GRACE_PERIOD.to_i
    RainbowMoment.where(status: "closing")
                  .where("ends_at + make_interval(secs => ?) <= ?", grace_seconds, Time.current)
                  .find_each(&:archive!)

    # Schedule next run
    self.class.set(wait: 1.minute).perform_later unless Rails.env.test?
  end
end
