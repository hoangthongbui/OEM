import React,{ Component } from "react";
import { connect } from "react-redux";
import {
  KeyboardAvoidingView,
  Image,
  StyleSheet,
  TextInput,
  Alert,
  ToastAndroid,
  AsyncStorage,
  Text,
  TouchableOpacity,
  ProgressBarAndroid,
  Platform,
  Keyboard, 
  TouchableWithoutFeedback
} from 'react-native';
import LinearGradient from "react-native-linear-gradient";
import DeviceInfo from "react-native-device-info";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { 
  CONTENT_TYPE, 
  USER, TOKEN, 
  PHONENUMBER, IOS, 
  SESSION_EXPIRE_TIME, 
  HELLO_HAVE_A_NICE_DAY,
  HELLO_INPUT_PASSWORD_TO_CONTINUE,
  HELLO_WELCOME_TO_OEM,
  ANDROID,
  GRADIENT_COLOR,
  PROMT_INPUT_PASSWORD
} from "../../constants/common";
import { 
  NOTIFICATION, 
  ERR_PHONE_NUMBER_NOT_FOUND, 
  ERR_NO_PASS, ERR_NO_ACCOUNT, 
  ERR_WRONG_PASSWORD, 
  ERR_INTERNET_CONNECTION, 
  ERR_SERVER_ERROR,
  ERR_PHONE_NUMBER_NOT_FOUND_IOS
} from "../../constants/alert";
import axios from "axios";
import { requestPhoneNumber, requestLoginURL } from "../../apis/loginAPI";
import autobind from "class-autobind";
import { baseColor } from "../../constants/mainSetting";
import { requestAccountByPhoneNumber, requestUpdateUserInfo } from "../../apis/userAPI";
import renderBottomTab from "../../elements/bottomTab";
import { Navigation } from "react-native-navigation";
import firebase from "react-native-firebase";
import moment from "moment";
import RNExitApp from "react-native-exit-app";


class Login extends Component {
  //options for navigation
  static get options() {
    return {
      topBar: {
        visible: false,
      }
    }
  }

  //contructors
  constructor(props) {
    super(props)
    this.state = {
      isLoggedIn: false,
      phoneNumber: "",
      password: "",
      welcomeText: ""
    }
   autobind(this)
  }
  
  async componentWillMount() {
    axios.defaults.headers.common[CONTENT_TYPE] = "application/json"
  }

  _showErrorMessage(message) {
    if (Platform.OS === ANDROID) {
      ToastAndroid.showWithGravity(
        message,
        ToastAndroid.SHORT,
        ToastAndroid.BOTTOM,
      );
    }
    else {
      Alert.alert(NOTIFICATION, message)
    }
  }
  //called after view is rendered
  async componentDidMount() {
    //console.log("minutes: ", )
    //console.log("date + time expired: ", 
    let arr = [HELLO_HAVE_A_NICE_DAY, HELLO_INPUT_PASSWORD_TO_CONTINUE,HELLO_WELCOME_TO_OEM]
    this.setState({
      welcomeText: arr[Math.floor(Math.random() * arr.length) + 0]
    })
    let macAddress = ""
    macAddress = await DeviceInfo.getMACAddress()
    axios.get(requestPhoneNumber(macAddress)).then(phoneNumber => {
      if (phoneNumber.data === "") {
        let errMessage = (Platform.OS === IOS) ? 
            ERR_PHONE_NUMBER_NOT_FOUND_IOS + macAddress : ERR_PHONE_NUMBER_NOT_FOUND
        Alert.alert(NOTIFICATION, errMessage ,[], {
          onDismiss: async () => {
            RNExitApp.exitApp()
          }
        })
        return;
      } else {
        this.setState({
          phoneNumber: phoneNumber.data
        })
      }
    }).catch(err => {
      console.log("err: ", err)
      //ToastAndroid.showWithGravity(
      //  ERR_SERVER_ERROR,
      //  ToastAndroid.SHORT,
      //  ToastAndroid.CENTER,
      //);
      this._showErrorMessage(ERR_SERVER_ERROR)
    })
  }

   _checkCondition() {
    if (this.state.password === "") {
      // ToastAndroid.showWithGravity(
      //   ERR_NO_PASS,
      //   ToastAndroid.SHORT,
      //   ToastAndroid.BOTTOM,
      // );
      this._showErrorMessage(ERR_NO_PASS)
      return false
    }
    else if (this.state.phoneNumber === "") {
      // ToastAndroid.showWithGravity(
      //   ERR_NO_ACCOUNT,
      //   ToastAndroid.SHORT,
      //   ToastAndroid.CENTER,
      // );
      this._showErrorMessage(ERR_NO_ACCOUNT)
      return false
    } 
    return true
   }

   async _setUserData(userData, token, timeExpired) {
      const today = moment(new Date()), 
            duration = moment.duration(timeExpired).asMinutes()
      await AsyncStorage.setItem(USER.ID, String(userData.id))
      await AsyncStorage.setItem(TOKEN, String(token))
      await AsyncStorage.setItem(PHONENUMBER, String(this.state.phoneNumber))
      await AsyncStorage.setItem(SESSION_EXPIRE_TIME, 
        today.add(duration, "minutes").toString())
      const tokenFirebase = await firebase.messaging().getToken()
      //console.log("token firebase at login page: ", tokenFirebase)
      const link = requestUpdateUserInfo(userData.id)
      //console.log('link token firebase: ', link)
      axios({
        url: link,
        method: "PUT",
        data: {
          "key": "tokenFirebase",
          "value": tokenFirebase
        },
        headers: {
          Authorization: token
        }
      })
   }

   _navigateToMainPage(userId) {
      Navigation.setRoot({
        root: {
          bottomTabs: renderBottomTab({userId: userId})
        }
      })
   }

  //other functions 
  async _handleLogin() {
    const submitLink = requestLoginURL();
    if (this._checkCondition()) {
      // axios.post(submitLink,{
      //   "username": this.state.phoneNumber,
      //   "password": this.state.password 
      // })
      axios({
        url: submitLink,
        method: "POST",
        data: {
          "username": this.state.phoneNumber,
          "password": this.state.password
        },
        headers: {
          "Content-Type": 'application/json', 
        }
      })
      .then((res) => {
        const token = "Bearer " + res.data.token
        const expiredTime = res.data.expired_time
        axios.get(requestAccountByPhoneNumber(this.state.phoneNumber),{
          headers: {
            "Content-Type": 'application/json',
            Authorization: token,
          }
        }).then(userData => {
          this._setUserData(userData.data, token, expiredTime)
          this._navigateToMainPage(userData.data.id)
        })
      }).catch(err => {
        console.log('err: ', err)
        switch(err.response.status) {
        case 401:
          //ToastAndroid.showWithGravity(
          //  ERR_WRONG_PASSWORD, 
          //  ToastAndroid.SHORT,
          //  ToastAndroid.CENTER
          //)
          this._showErrorMessage(ERR_WRONG_PASSWORD)
          break 
        case 404: 
          //ToastAndroid.showWithGravity(
          //  ERR_INTERNET_CONNECTION, 
          //  ToastAndroid.SHORT,
          //  ToastAndroid.CENTER
          //)
          this._showErrorMessage(ERR_INTERNET_CONNECTION)
          break;
        case 500:
        case 502: 
          //ToastAndroid.showWithGravity(
          //  ERR_SERVER_ERROR, 
          //  ToastAndroid.SHORT,
          //  ToastAndroid.BOTTOM
          //)
          this._showErrorMessage(ERR_SERVER_ERROR)
          break
        }
      })
    }
  }

  //render view 
  render() {
    return (
      <KeyboardAvoidingView behavior="padding" style={{flex: 1}} enabled>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <LinearGradient 
          start={{x: 0, y: 1}} end={{x: 0, y: 0}} 
          colors={GRADIENT_COLOR} 
          style={styles.container}>
            <Image source={require('../../assets/icon/welcomeLogo.png')} />
              <Text style={styles.phoneNumberText}>
                {this.state.welcomeText}
              </Text>
            <TextInput 
              placeholderTextColor={"#ccc"}
              secureTextEntry={true} 
              placeholder={PROMT_INPUT_PASSWORD}
              keyboardType="numeric"
              style={styles.textInputStyle} 
                value={this.state.password}
                onChangeText={(text) => this.setState({
                  password: text
                })}
            /> 
            {
              (this.state.isLoggedIn) ? 
              <ProgressBarAndroid animating={true} color="white"/> :
              <TouchableOpacity
                onPress={this._handleLogin}
                style={styles.loginButtonStyle}> 
                <Text style={styles.titleLoginButtonStyle}> ĐĂNG NHẬP </Text> 
                <MaterialIcons name="navigate-next" size={25} color={baseColor}/>
              </TouchableOpacity> 
            }
        </LinearGradient> 
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    )
  }
}

const styles = StyleSheet.create({
  // phoneNumberView: {
  //   width: DEVICE_WIDTH,
  //   alignItems: "center",
  //   justifyContent: "center",
  // },
  phoneNumberText: {
    fontSize: 22,
    color: "white",
    textAlign: "center",
    fontFamily: "Roboto-Black"
  },
  textInputStyle: {
    borderBottomWidth: 1.5,
    borderBottomColor: "white",
    backgroundColor: "transparent",
    width: 250,
    color: "white",
    fontSize: 20,
    justifyContent: "center",
    margin: 12
  },
  container: {
    flex: 1,
    alignItems:'center',
    justifyContent: 'space-evenly',
    flexDirection: 'column',
  },
  titleStyle: {
    fontFamily: 'Lato-Bold',
    fontSize: 20
  },
  loginButtonStyle: {
    flexDirection: "row",
    backgroundColor:"white",
    width: 250,
    height: 50,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  titleLoginButtonStyle: {
    fontFamily: 'Roboto-Regular',
    fontSize: 16,
    color: baseColor
  }
})

export default connect(
  null, 
  null 
)(Login)