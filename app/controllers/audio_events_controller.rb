class AudioEventsController < ApplicationController
  # GET /audio_events
  # GET /audio_events.json
  def index
    @audio_events = AudioEvent.all

    respond_to do |format|
      format.html # index.html.erb
      format.json { render json: @audio_events }
    end
  end

  # GET /audio_events/1
  # GET /audio_events/1.json
  def show
    @audio_event = AudioEvent.find(params[:id])

    respond_to do |format|
      format.html # show.html.erb
      format.json { render json: @audio_event }
    end
  end

  # GET /audio_events/new
  # GET /audio_events/new.json
  def new
    @audio_event = AudioEvent.new

    respond_to do |format|
      format.html # new.html.erb
      format.json { render json: @audio_event }
    end
  end

  # GET /audio_events/1/edit
  def edit
    @audio_event = AudioEvent.find(params[:id])
  end

  # POST /audio_events
  # POST /audio_events.json
  def create
    @audio_event = AudioEvent.new(params[:audio_event])

    respond_to do |format|
      if @audio_event.save
        format.html { redirect_to @audio_event, notice: 'Audio event was successfully created.' }
        format.json { render json: @audio_event, status: :created, location: @audio_event }
      else
        format.html { render action: "new" }
        format.json { render json: @audio_event.errors, status: :unprocessable_entity }
      end
    end
  end

  # PUT /audio_events/1
  # PUT /audio_events/1.json
  def update
    @audio_event = AudioEvent.find(params[:id])

    respond_to do |format|
      if @audio_event.update_attributes(params[:audio_event])
        format.html { redirect_to @audio_event, notice: 'Audio event was successfully updated.' }
        format.json { head :no_content }
      else
        format.html { render action: "edit" }
        format.json { render json: @audio_event.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /audio_events/1
  # DELETE /audio_events/1.json
  def destroy
    @audio_event = AudioEvent.find(params[:id])
    @audio_event.destroy

    respond_to do |format|
      format.html { redirect_to audio_events_url }
      format.json { head :no_content }
    end
  end
end