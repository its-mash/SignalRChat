var api = "https://localhost:7086"
var token ="eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTUxMiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9lbWFpbGFkZHJlc3MiOiJ0ZXN0QG1haWwuY29tIiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvbmFtZSI6InRlc3QiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjEiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJVc2VyIiwiZXhwIjoxNjU2NDMzODQ3fQ.O9cBxNrAx8MP4_Sn7iouGipMPNCEytzobN-VQYKXgFcXzCxfBNiU2DHg83YAt0tPRVVPTWg65eM4K_Cm7DXYWQ"
$(document).ready(function () {
    var connection = new signalR.HubConnectionBuilder().withUrl(api+"/chatHub",
        {
            accessTokenFactory: () => token
        }).build();

    connection.start().then(function () {
        console.log('SignalR Started...')
        viewModel.roomList();
        viewModel.userList();
    }).catch(function (err) {
        return console.error(err);
    });

    connection.on("newMessage", function (messageView) {
        var isMine = messageView.fromUser === viewModel.myName();
        var message = new ChatMessage(messageView.content, messageView.timestamp, messageView.fromUser, isMine, messageView.avatar, messageView.attachmentUrl);
        viewModel.chatMessages.push(message);
        $(".chat-body").animate({ scrollTop: $(".chat-body")[0].scrollHeight }, 1000);
    });

    connection.on("setProfileInfo", function (displayName, avatar) {
        viewModel.myName(displayName);
        viewModel.myAvatar(avatar);
        viewModel.isLoading(false);
    });

    connection.on("addUser", function (user) {
        viewModel.userAdded(new ChatUser(user.username, user.fullName, user.avatar, user.currentRoom, user.device));
    });

    connection.on("removeUser", function (user) {
        viewModel.userRemoved(user.username);
    });

    connection.on("addChatRoom", function (room) {
        viewModel.roomAdded(new ChatRoom(room.id, room.name));
    });

    connection.on("updateChatRoom", function (room) {
        viewModel.roomUpdated(new ChatRoom(room.id, room.name));
    });

    connection.on("removeChatRoom", function (id) {
        viewModel.roomDeleted(id);
    });

    connection.on("onError", function (message) {
        viewModel.serverInfoMessage(message);
        $("#errorAlert").removeClass("d-none").show().delay(5000).fadeOut(500);
    });

    connection.on("onRoomDeleted", function (message) {
        viewModel.serverInfoMessage(message);
        $("#errorAlert").removeClass("d-none").show().delay(5000).fadeOut(500);

        if (viewModel.chatRooms().length == 0) {
            viewModel.joinedRoom("");
        }
        else {
            // Join to the first room in list
            setTimeout(function () {
                $("ul#room-list li a")[0].click();
            }, 50);
        }
    });

    function AppViewModel() {
        var self = this;

        self.message = ko.observable("");
        self.chatRooms = ko.observableArray([]);
        self.chatUsers = ko.observableArray([]);
        self.chatMessages = ko.observableArray([]);
        self.joinedRoom = ko.observable("");
        self.joinedRoomId = ko.observable("");
        self.serverInfoMessage = ko.observable("");
        self.myName = ko.observable("");
        self.myAvatar = ko.observable("avatar1.png");
        self.isLoading = ko.observable(true);

        self.onEnter = function (d, e) {
            if (e.keyCode === 13) {
                self.sendNewMessage();
            }
            return true;
        }
        self.filter = ko.observable("");
        self.filteredChatUsers = ko.computed(function () {
            if (!self.filter()) {
                return self.chatUsers();
            } else {
                return ko.utils.arrayFilter(self.chatUsers(), function (user) {
                    var displayName = user.displayName().toLowerCase();
                    return displayName.includes(self.filter().toLowerCase());
                });
            }
        });

        self.sendNewMessage = function () {
            //var text = self.message();
            //if (text.startsWith("/")) {
            //    var receiver = text.substring(text.indexOf("(") + 1, text.indexOf(")"));
            //    var message = text.substring(text.indexOf(")") + 1, text.length);
            //    self.sendPrivate(receiver, message);
            //}
            //else {
            self.sendToRoom(self.joinedRoomId(), self.message());
            //}

            self.message("");
        }

        self.sendToRoom = function (roomId, message) {
            if (message.length > 0) {
                fetch(api+'/api/Messages/Create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json',"Authorization":" Bearer "+token },
                    body: JSON.stringify({ roomId: roomId, content: message })
                });
            }
        }

        self.sendPrivate = function (receiver, message) {
            if (receiver.length > 0 && message.length > 0) {
                connection.invoke("SendPrivate", receiver.trim(), message.trim());
            }
        }

        self.joinRoom = function (room) {
            connection.invoke("Join", room.name()).then(function () {
                self.joinedRoom(room.name());
                self.joinedRoomId(room.id());
                self.userList();
                self.messageHistory();
            });
        }
        self.roomList = function () {
            fetch(api + '/api/Tournament/TournamentList',
                    {
                        headers: { "Authorization": " Bearer " + token }
                    })
                .then(response => response.json())
                .then(data => {
                    self.chatRooms.removeAll();
                    for (var i = 0; i < data.length; i++) {
                        self.chatRooms.push(new ChatRoom(data[i].id, data[i].tournamentName));
                    }

                    if (self.chatRooms().length > 0)
                        self.joinRoom(self.chatRooms()[0]);
                });
        }

        self.userList = function () {
            connection.invoke("GetUsers", self.joinedRoom()).then(function (result) {
                self.chatUsers.removeAll();
                for (var i = 0; i < result.length; i++) {
                    self.chatUsers.push(new ChatUser(result[i].username,
                        result[i].fullName,
                        result[i].avatar,
                        result[i].currentRoom,
                        result[i].device))
                }
            });
        }

        self.createRoom = function () {
            var roomName = $("#roomName").val();
            fetch(api+'/api/Rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: roomName })
            });
        }

        self.editRoom = function () {
            var roomId = self.joinedRoomId();
            var roomName = $("#newRoomName").val();
            fetch(api+'/api/Rooms/' + roomId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: roomId, name: roomName })
            });
        }

        self.deleteRoom = function () {
            fetch(api+'/api/Rooms/' + self.joinedRoomId(), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: self.joinedRoomId() })
            });
        }

        self.messageHistory = function () {
            fetch(api +'/api​/Messages​/GetTournamentMessages​/' + viewModel.joinedRoomId(),
                    {
                        headers: { "Authorization": " Bearer " + token}
                    })
                .then(response => response.json())
                .then(data => {
                    self.chatMessages.removeAll();
                    for (var i = 0; i < data.length; i++) {
                        var isMine = data[i].fromUser == self.myName();
                        self.chatMessages.push(new ChatMessage(data[i].content,
                            data[i].timestamp,
                            data[i].fromUser,
                            isMine,
                            data[i].avatar,data[i].attachmentUrl))
                    }

                    $(".chat-body").animate({ scrollTop: $(".chat-body")[0].scrollHeight }, 1000);
                });
        }

        self.roomAdded = function (room) {
            self.chatRooms.push(room);
        }

        self.roomUpdated = function (updatedRoom) {
            var room = ko.utils.arrayFirst(self.chatRooms(), function (item) {
                return updatedRoom.id() == item.id();
            });

            room.name(updatedRoom.name());

            if (self.joinedRoomId() == room.id()) {
                self.joinRoom(room);
            }
        }

        self.roomDeleted = function (id) {
            var temp;
            ko.utils.arrayForEach(self.chatRooms(), function (room) {
                if (room.id() == id)
                    temp = room;
            });
            self.chatRooms.remove(temp);
        }

        self.userAdded = function (user) {
            self.chatUsers.push(user);
        }

        self.userRemoved = function (id) {
            var temp;
            ko.utils.arrayForEach(self.chatUsers(), function (user) {
                if (user.userName() == id)
                    temp = user;
            });
            self.chatUsers.remove(temp);
        }

        self.uploadFiles = function () {
            var form = document.getElementById("uploadForm");
            var content = document.getElementById("uploadFormContent");
            $.ajax({
                type: "POST",
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('Authorization', 'Bearer '+token);
                },
                url: api+'/api/Upload',
                data: new FormData(form),
                contentType: false,
                processData: false,
                success: function () {
                    $("#UploadedFile").val("");
                },
                error: function (error) {
                    alert('Error: ' + error.responseText);
                }
            });
        }
    }

    function ChatRoom(id, name) {
        var self = this;
        self.id = ko.observable(id);
        self.name = ko.observable(name);
    }

    function ChatUser(userName, displayName, avatar, currentRoom, device) {
        var self = this;
        if (displayName == undefined) {
            displayName = userName
        }
        self.userName = ko.observable(userName);
        self.displayName = ko.observable(displayName);
        self.avatar = ko.observable(avatar);
        self.currentRoom = ko.observable(currentRoom);
        self.device = ko.observable(device);
    }

    function ChatMessage(content, timestamp, from, isMine, avatar,attachmentUrl) {
        var self = this;
        self.content = ko.observable(content);
        self.timestamp = ko.observable(timestamp);
        self.from = ko.observable(from);
        self.isMine = ko.observable(isMine);
        self.avatar = ko.observable(avatar);
        self.attachmentUrl = ko.observable(attachmentUrl);
    }

    var viewModel = new AppViewModel();
    ko.applyBindings(viewModel);
});
